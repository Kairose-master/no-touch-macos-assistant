import { mkdir, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { dataRoot, digest, readJson, writeJson } from './storage.ts';
import { workPlan, resolveWhen, type WorkPlan, type WorkRequest } from './work-contracts.ts';
import { writeNote, addReminder, latestFiles, changeFile } from './office.ts';
import type { ChangeInput } from './contracts.ts';
export type JobStep = { kind: string; input: Record<string, any>; status: 'pending'|'started'|'verified'|'denied'|'uncertain'; output?: any; error?: string; approvedFingerprint?: string };
export type Job = { id: string; name: string; sessionId: string; executionKey: string; mode: string; plan: WorkPlan; layout: 'cards'|'compact'; status: 'awaiting-approval'|'running'|'completed'|'cancelled'|'uncertain'|'blocked'; planApproved?: boolean; planApprovalCallIds?: string[]; lastPlanApprovedAt?: string; cancelRequested: boolean; createdAt: string; steps: JobStep[]; preview: string };
const idPattern=/^[a-f0-9]{64}$/;
function pathFor(kind: 'jobs'|'recipes', id: string) { if(!idPattern.test(id)) throw new Error('INVALID_WORK_ID'); return join(dataRoot(),kind,`${id}.json`); }
export async function readJob(id:string) { const job=await readJson<Job|null>(pathFor('jobs',id),null);if(!job)throw new Error('WORK_NOT_FOUND');if(job.mode!==(process.env.NO_TOUCH_MODE??'fixture'))throw new Error('WORK_MODE_MISMATCH');if(await readJson(pathFor('jobs',id).replace('.json','.cancel.json'),false)){job.cancelRequested=true;if(job.status!=='completed')job.status='cancelled';}return job; }
export async function persistJob(job:Job) { await mkdir(join(dataRoot(),'jobs'),{recursive:true,mode:0o700});await writeJson(pathFor('jobs',job.id),job); }
export function planPreview(plan:WorkPlan) {
  return plan.steps.map((step,index)=>`${index+1}. ${step.kind==='note'?`Notes [com.apple.Notes] · 전용 NoTouch 폴더에 신규 메모 "${step.title}"\n본문: ${step.body}`:step.kind==='reminder'?`Reminders [com.apple.reminders] · 전용 NoTouch 목록에 신규 일정 "${step.title}" · ${JSON.stringify(step.when)}`:step.kind==='files'?'Finder [com.apple.finder] · marker가 있는 전용 샘플 파일만 조회':`Finder 샘플 파일 · ${step.target} → ${step.destination} (${step.action}) · 실행 직전 별도 파일 승인 필요`}`).join('\n\n')+`\n\n화면: ${plan.layout}. 외부 공유·기존 메모/알림 편집·임의 앱·코드 변경 없음.`;
}
export async function prepareJob(sessionId:string,request:WorkRequest,executionKey=sessionId) {
  if(request.resumeJobId){const job=await readJob(request.resumeJobId);if(job.status==='cancelled'||job.cancelRequested)throw new Error('CANCELLED_WORK_IS_FINAL');return job;}
  const recipe=request.recipeId?await readJson<{plan:WorkPlan}|null>(pathFor('recipes',request.recipeId),null):null;
  const plan=workPlan.parse(request.plan??recipe?.plan);const mode=process.env.NO_TOUCH_MODE??'fixture';
  const id=digest({sessionId,executionKey,plan,mode});const old=await readJson<Job|null>(pathFor('jobs',id),null);if(old)return old;
  const prior=await history('jobs',0);
  if(prior.items.some(item=>item.executionKey===executionKey&&item.sessionId===sessionId))throw new Error('ONE_PLAN_PER_TURN: inspect or resume the original work; do not replace it.');
  const unresolved=prior.items.some(item=>{
    const unresolvedSteps=Array.isArray(item.steps)&&item.steps.some(step=>step&&typeof step==='object'&&['started','uncertain'].includes(String((step as Record<string,unknown>).status)));
    return (item.status==='uncertain'||item.status==='blocked'||unresolvedSteps)&&digest(item.plan)===digest(plan);
  });
  if(unresolved)throw new Error('MATCHING_UNCERTAIN_WORK: reconcile the original work before a new run.');
  const now=new Date();const steps:JobStep[]=plan.steps.map(step=>({kind:step.kind,input:step.kind==='reminder'?{title:step.title,...resolveWhen(step.when,now)}:step,status:'pending'}));
  const job:Job={id,name:plan.name,sessionId,executionKey,mode,plan,layout:plan.layout,status:'awaiting-approval',planApproved:false,cancelRequested:false,createdAt:now.toISOString(),steps,preview:planPreview(plan)};
  // Resolve the exact file before the plan approval; recheck its fingerprint at execution.
  let cards:Awaited<ReturnType<typeof latestFiles>>['cards']|undefined;
  for(const step of steps) if(step.kind==='file_change') {
    cards??=(await latestFiles()).cards;
    const matches=step.input.target==='latest'?cards.slice(0,1):cards.filter(card=>card.name===step.input.target);
    if(matches.length!==1)throw new Error('FILE_NOT_UNIQUELY_RESOLVED');
    const card=matches[0]!;step.input={action:step.input.action,name:card.name,fingerprint:card.fingerprint,destination:step.input.destination};
  }
  job.preview+=`\n\n확정 일정·파일:\n${steps.filter(s=>s.kind==='reminder'||s.kind==='file_change').map(s=>JSON.stringify(s.input)).join('\n')}`;
  await persistJob(job);return job;
}
export async function acceptJob(id:string,approved:boolean,approvalCallId?:string) {
  const job=await readJob(id);
  if(job.cancelRequested||job.status==='cancelled')throw new Error('WORK_CANCELLED');
  if(approved&&approvalCallId!==undefined){
    if(!approvalCallId.trim())throw new Error('INVALID_APPROVAL_CALL_ID');
    const recorded=job.planApprovalCallIds??[];
    if(!recorded.includes(approvalCallId)){
      job.planApprovalCallIds=[...new Set([...recorded,approvalCallId])];
      job.lastPlanApprovedAt=new Date().toISOString();
    }
  }
  job.status=approved?'running':'cancelled';job.planApproved=approved;job.cancelRequested=!approved;
  await persistJob(job);return job;
}
export async function stepChangePreview(id:string,index:number) {const job=await readJob(id);return `파일별 명시적 승인 · ${JSON.stringify(job.steps[index]!.input)}\n이 정확한 샘플 변경만 승인합니다. 공유는 외부 전송 없는 로컬 preview입니다.`;}
export async function approveFileStep(id:string,index:number) {const job=await readJob(id);const step=job.steps[index];if(!step||step.kind!=='file_change'||job.cancelRequested)throw new Error('INVALID_FILE_APPROVAL');step.approvedFingerprint=digest(step.input);await persistJob(job);}
export async function executeJobStep(id:string,index:number) {
  const job=await readJob(id);const step=job.steps[index];if(!step)throw new Error('INVALID_STEP');
  if(job.cancelRequested||job.status==='cancelled')return {cancelled:true};
  if(step.status==='verified')return step.output;
  if(step.status==='denied')throw new Error('DENIED_STEP_IS_FINAL');
  if(job.status==='awaiting-approval')throw new Error('WORK_NOT_APPROVED');
  if(step.kind==='file_change'&&step.approvedFingerprint!==digest(step.input))throw new Error('FILE_STEP_APPROVAL_REQUIRED');
  // A later preflight failure cannot erase an earlier possibly delivered effect.
  const hadUncertainEffect=step.status==='started'||step.status==='uncertain';
  // Re-entry is safe only through the office operation ledger: verified outputs replay,
  // reservations with uncertain effects never dispatch again.
  step.status='started';job.status='running';await persistJob(job);
  try {
    const scope=`work:${id}:${index}`;const input=step.input;
    const output=step.kind==='note'?await writeNote(scope,{title:input.title,body:input.body}):step.kind==='reminder'?await addReminder(scope,{title:input.title,dueAt:input.dueAt,timeZone:input.timeZone}):step.kind==='files'?await latestFiles():await changeFile(scope,input as ChangeInput);
    // Reload so a concurrent cancel request is retained.
    const fresh=await readJob(id);fresh.steps[index]={...step,status:'verified',output,error:undefined};await persistJob(fresh);return output;
  } catch(error) {const fresh=await readJob(id);const message=error instanceof Error?error.message:'WORK_FAILED';const notStarted=step.kind==='files'||(!hadUncertainEffect&&/^NOTES_PREPARATION_FAILED:|^FINDER_PREPARATION_FAILED:|^DESKTOP_BUSY:/.test(message));fresh.status=notStarted?'blocked':'uncertain';fresh.steps[index]={...step,status:notStarted?'pending':'uncertain',error:message};await persistJob(fresh);throw error;}
}
export async function finishJob(id:string) {const job=await readJob(id);for(const step of job.steps)if(step.status==='verified')delete step.error;if(job.steps.every(s=>s.status==='verified'))job.status='completed';await persistJob(job);return {kind:'work',...job};}
export async function cancelJob(id:string,index?:number) {const job=await readJob(id);if(job.status==='completed')return {kind:'work',...job};await writeJson(pathFor('jobs',id).replace('.json','.cancel.json'),true);job.cancelRequested=true;job.status='cancelled';if(index!==undefined&&job.steps[index]&&!['started','uncertain','verified'].includes(job.steps[index]!.status))job.steps[index]!.status='denied';await persistJob(job);return {kind:'work',...job};}
export async function history(kind:'jobs'|'recipes',limit=50) {
  await mkdir(join(dataRoot(),kind),{recursive:true,mode:0o700});const out=[];
  for(const file of (await readdir(join(dataRoot(),kind))).filter(f=>/^[a-f0-9]{64}\.json$/.test(f)))out.push(kind==='jobs'?await readJob(file.slice(0,-5)):await readJson<Record<string,unknown>>(join(dataRoot(),kind,file),{}));
  out.sort((a,b)=>String(b.createdAt??'').localeCompare(String(a.createdAt??'')));return {kind,items:limit?out.slice(0,limit):out};
}
export async function testRecipe(plan:WorkPlan) {
  return new Promise<{passed:boolean;stepCount:number}>((accept,reject)=>{
    const child=spawn(process.execPath,['--experimental-strip-types','scripts/test-recipe.ts'],{env:{...process.env,NO_TOUCH_MODE:'fixture',NO_TOUCH_MODEL:'rehearsal'},shell:false,stdio:['pipe','pipe','pipe'],timeout:20000});let output='';child.stdout.on('data',data=>{output+=data.toString();if(output.length>100000)child.kill();});child.stderr.resume();child.on('error',reject);child.on('close',()=>{try{const result=JSON.parse(output);if(!result.passed)throw new Error('RECIPE_TEST_FAILED');accept(result);}catch{reject(new Error('RECIPE_TEST_FAILED'));}});child.stdin.end(JSON.stringify(plan));
  });
}
export async function saveRecipe(plan:WorkPlan,test:{passed:boolean;stepCount:number}) {if(!test.passed)throw new Error('RECIPE_TEST_REQUIRED');const id=digest(plan);await mkdir(join(dataRoot(),'recipes'),{recursive:true,mode:0o700});const result={kind:'recipe',id,plan,test,permissions:['NoTouch 신규 메모','NoTouch 신규 알림','전용 샘플 파일만','파일 변경은 매번 별도 승인'],createdAt:new Date().toISOString()};await writeJson(pathFor('recipes',id),result);return result;}
