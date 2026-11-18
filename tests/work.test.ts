import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,realpath,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {workPlan,resolveWhen,type WorkPlan} from '../agent/lib/work-contracts.ts';
import {prepareJob,acceptJob,executeJobStep,cancelJob,readJob,testRecipe,saveRecipe,approveFileStep,finishJob} from '../agent/lib/work.ts';
import {seed} from '../scripts/seed.ts';
import {toolPolicy} from '../agent/lib/contracts.ts';
const plan:WorkPlan={name:'회의 준비',layout:'compact',steps:[{kind:'note',title:'sample',body:'Only sample data'},{kind:'reminder',title:'sample',when:{kind:'tomorrow',hour:15,minute:0,timeZone:'Asia/Seoul'}},{kind:'files'}]};
async function setup(){process.env.NO_TOUCH_MODE='fixture';process.env.NO_TOUCH_MODEL='rehearsal';process.env.NO_TOUCH_DATA_DIR=await realpath(await mkdtemp(join(tmpdir(),'no-touch-work-test-')));await seed();return process.env.NO_TOUCH_DATA_DIR;}
test('relative tomorrow follows Seoul calendar boundaries and recipe schemas reject code or unscoped apps',()=>{
 assert.equal(resolveWhen({kind:'tomorrow',hour:15,minute:0,timeZone:'Asia/Seoul'},new Date('2026-11-18T16:00:00Z')).dueAt,'2026-11-20T15:00:00+09:00');
 assert.throws(()=>workPlan.parse({...plan,shell:'rm -rf user-data'}));assert.throws(()=>workPlan.parse({...plan,steps:[{kind:'app',bundleId:'com.apple.Mail'}]}));
 process.env.NO_TOUCH_MODEL='chatgpt';for(const tool of ['write_note','add_reminder','latest_files','change_file','bash','desktop_click'])assert.equal(toolPolicy(tool)?.type,'denied');assert.equal(toolPolicy('office_work'),undefined);process.env.NO_TOUCH_MODEL='rehearsal';
});
test('reviewed work persists completed outputs and replays without duplicating created notes',async()=>{
 const root=await setup();const job=await prepareJob('session',{operation:'run',plan},'turn');
 await assert.rejects(executeJobStep(job.id,0),/WORK_NOT_APPROVED/);
 const accepted=await acceptJob(job.id,true);assert.equal(accepted.planApprovalCallIds,undefined);assert.equal(accepted.lastPlanApprovedAt,undefined);const result=await executeJobStep(job.id,0);assert.deepEqual(await executeJobStep(job.id,0),result);
 const state=JSON.parse(await readFile(join(root,'apps.json'),'utf8'));assert.equal(state.notes.length,1);
 assert.equal((await readJob(job.id)).steps[0]!.status,'verified');
 await assert.rejects(prepareJob('session',{operation:'run',plan:{...plan,name:'replacement'}},'turn'),/ONE_PLAN_PER_TURN/);
});
test('cancellation retains finished work and blocks pending writes and replacement plans in the same turn',async()=>{
 const root=await setup();const job=await prepareJob('session',{operation:'run',plan},'turn');await acceptJob(job.id,true);await executeJobStep(job.id,0);await cancelJob(job.id);
 assert.deepEqual(await executeJobStep(job.id,1),{cancelled:true});
 const state=JSON.parse(await readFile(join(root,'apps.json'),'utf8'));assert.equal(state.notes.length,1);assert.equal(state.reminders.length,0);
 await assert.rejects(prepareJob('session',{operation:'run',resumeJobId:job.id},'next-turn'),/CANCELLED_WORK_IS_FINAL/);
});
test('file execution requires its own exact fingerprint approval, and changed files stop without replaying a note',async()=>{
 const root=await setup();const filePlan:WorkPlan={...plan,steps:[plan.steps[0]!,{kind:'file_change',action:'move',target:'latest',destination:'Archive'}]};
 const job=await prepareJob('session',{operation:'run',plan:filePlan},'turn');await acceptJob(job.id,true);await executeJobStep(job.id,0);
 await assert.rejects(executeJobStep(job.id,1),/FILE_STEP_APPROVAL_REQUIRED/);
 await approveFileStep(job.id,1);
 await writeFile(join(root,'files',String(job.steps[1]!.input.name)),'Changed after approval');
 await assert.rejects(executeJobStep(job.id,1),/FILE_CHANGED/);await executeJobStep(job.id,0);
 await assert.rejects(executeJobStep(job.id,1),/OUTCOME_UNCERTAIN/);
 assert.equal(JSON.parse(await readFile(join(root,'apps.json'),'utf8')).notes.length,1);
 assert.equal((await readJob(job.id)).status,'uncertain');
 await assert.rejects(prepareJob('another',{operation:'run',plan:filePlan},'new-turn'),/MATCHING_UNCERTAIN_WORK/);
});
test('recipe is actually tested in a separate fixture, saved as data and retains relative dates and bounded layout',async()=>{
 await setup();const verified=workPlan.parse(plan);const result=await testRecipe(verified);assert.equal(result.passed,true);const recipe=await saveRecipe(verified,result);
 assert.equal(recipe.plan.layout,'compact');assert.equal(recipe.plan.steps[1]!.kind,'reminder');assert.equal(result.stepCount,3);
});
test('retained workspace cannot change mode or data scope before starting any server or app',async()=>{
 const {mkdir}=await import('node:fs/promises');const {spawnSync}=await import('node:child_process');const {resolve}=await import('node:path');
 const root=await realpath(await mkdtemp(join(tmpdir(),'no-touch-scope-test-')));await mkdir(join(root,'.eve'));await writeFile(join(root,'.eve','no-touch-scope.json'),JSON.stringify({mode:'fixture',dataDirectory:root}));
 const result=spawnSync(process.execPath,[resolve('scripts/run-demo.mjs'),'--live'],{cwd:root,env:{...process.env,NO_TOUCH_LIVE:'I_AUTHORIZE_ISOLATED_APP_CONTROL'},encoding:'utf8'});assert.equal(result.status,1);assert.match(result.stderr,/WORKFLOW_SCOPE_MISMATCH/);assert.equal(result.stdout,'');
});
test('app-lock preparation failure stays pending and does not reserve or duplicate a note',async()=>{
 const {mkdir,rmdir,readdir}=await import('node:fs/promises');const root=await setup();const job=await prepareJob('blocked',{operation:'run',plan},'blocked-turn');await acceptJob(job.id,true);await mkdir(join(root,'desktop.lock'));
 await assert.rejects(executeJobStep(job.id,0),/DESKTOP_BUSY/);const blocked=await readJob(job.id);assert.equal(blocked.status,'blocked');assert.equal(blocked.planApproved,true);assert.equal(blocked.steps[0]!.status,'pending');
 const reservations=await readdir(join(root,'operations')).catch(()=>[]);assert.equal(reservations.length,0);
 await rmdir(join(root,'desktop.lock'));await executeJobStep(job.id,0);await executeJobStep(job.id,0);assert.equal(JSON.parse(await readFile(join(root,'apps.json'),'utf8')).notes.length,1);
 const verified=await readJob(job.id);assert.equal(verified.steps[0]!.status,'verified');assert.equal(verified.steps[0]!.error,undefined);
});
test('plan approval evidence deduplicates the same runtime call and records a later approved call',async(context)=>{
 const root=await setup();const firstTime=Date.UTC(2026,10,18,10,0,0);const nextTime=firstTime+60000;
 context.mock.timers.enable({apis:['Date'],now:firstTime});
 const job=await prepareJob('approval-evidence',{operation:'run',plan},'approval-turn');
 assert.equal(job.planApprovalCallIds,undefined);assert.equal(job.lastPlanApprovedAt,undefined);
 const first=await acceptJob(job.id,true,'call-first');assert.deepEqual(first.planApprovalCallIds,['call-first']);assert.equal(first.lastPlanApprovedAt,new Date(firstTime).toISOString());
 context.mock.timers.setTime(nextTime);
 const repeated=await acceptJob(job.id,true,'call-first');assert.deepEqual(repeated.planApprovalCallIds,['call-first']);assert.equal(repeated.lastPlanApprovedAt,first.lastPlanApprovedAt);
 const second=await acceptJob(job.id,true,'call-second');assert.deepEqual(second.planApprovalCallIds,['call-first','call-second']);assert.equal(second.lastPlanApprovedAt,new Date(nextTime).toISOString());
 const persisted=JSON.parse(await readFile(join(root,'jobs',`${job.id}.json`),'utf8'));assert.deepEqual(persisted.planApprovalCallIds,second.planApprovalCallIds);assert.equal(persisted.lastPlanApprovedAt,second.lastPlanApprovedAt);
 context.mock.timers.setTime(nextTime+60000);
 const denied=await acceptJob(job.id,false,'call-denied');assert.deepEqual(denied.planApprovalCallIds,['call-first','call-second']);assert.equal(denied.lastPlanApprovedAt,second.lastPlanApprovedAt);assert.equal(denied.planApproved,false);assert.equal(denied.status,'cancelled');
});
test('completed-job replay clears obsolete verified-step errors without dispatching app writes',async()=>{
 const root=await setup();const job=await prepareJob('completed-replay',{operation:'run',plan},'replay-turn');await acceptJob(job.id,true,'call-original');
 for(let index=0;index<job.steps.length;index++)await executeJobStep(job.id,index);
 await finishJob(job.id);const path=join(root,'jobs',`${job.id}.json`);const stored=JSON.parse(await readFile(path,'utf8'));stored.steps[0].error='DESKTOP_BUSY: obsolete preparation failure';await writeFile(path,JSON.stringify(stored));
 const appsBefore=await readFile(join(root,'apps.json'),'utf8');const replayed=await finishJob(job.id);
 assert.equal(replayed.status,'completed');assert.equal(replayed.steps[0]!.error,undefined);assert.equal('approvalThisCall' in replayed,false);assert.deepEqual(replayed.planApprovalCallIds,['call-original']);
 const after=JSON.parse(await readFile(path,'utf8'));assert.equal(Object.hasOwn(after.steps[0],'error'),false);assert.equal(Object.hasOwn(after,'approvalThisCall'),false);assert.equal(await readFile(join(root,'apps.json'),'utf8'),appsBefore);
});
test('cancelling an uncertain job keeps unresolved effects blocking an identical replacement',async()=>{
 const root=await setup();const p:WorkPlan={...plan,steps:[{kind:'file_change',action:'move',target:'latest',destination:'Archive'}]};const job=await prepareJob('uncertain',{operation:'run',plan:p},'turn');await acceptJob(job.id,true);await approveFileStep(job.id,0);await writeFile(join(root,'files',String(job.steps[0]!.input.name)),'Changed');await assert.rejects(executeJobStep(job.id,0),/FILE_CHANGED/);await cancelJob(job.id);await assert.rejects(prepareJob('replacement',{operation:'run',plan:p},'new-turn'),/MATCHING_UNCERTAIN_WORK/);
});
test('read-only file readiness failure can resume while preserving completed write results',async()=>{
 const root=await setup();const p:WorkPlan={...plan,steps:[plan.steps[0]!,{kind:'files'}]};const job=await prepareJob('read-recovery',{operation:'run',plan:p},'turn');await acceptJob(job.id,true);await executeJobStep(job.id,0);await writeFile(join(root,'.no-touch-fixture'),'invalid-marker');await assert.rejects(executeJobStep(job.id,1),/FIXTURE_MARKER_REQUIRED/);assert.equal((await readJob(job.id)).status,'blocked');await writeFile(join(root,'.no-touch-fixture'),'no-touch-fixture-v1');await executeJobStep(job.id,0);await executeJobStep(job.id,1);assert.equal(JSON.parse(await readFile(join(root,'apps.json'),'utf8')).notes.length,1);
});
test('a later app-lock failure preserves uncertain effects through cancellation and blocks a replacement',async()=>{
 const {mkdir,rmdir}=await import('node:fs/promises');
 const root=await setup();
 const p:WorkPlan={...plan,steps:[{kind:'file_change',action:'move',target:'latest',destination:'Archive'}]};
 const job=await prepareJob('uncertain-before-lock',{operation:'run',plan:p},'turn');
 await acceptJob(job.id,true);await approveFileStep(job.id,0);
 await writeFile(join(root,'files',String(job.steps[0]!.input.name)),'Changed after approval');
 await assert.rejects(executeJobStep(job.id,0),/FILE_CHANGED/);
 assert.equal((await readJob(job.id)).steps[0]!.status,'uncertain');
 // A new readiness failure describes this retry, not the earlier reserved effect.
 await mkdir(join(root,'desktop.lock'));
 try{
  await assert.rejects(executeJobStep(job.id,0),/DESKTOP_BUSY/);
  const afterReadinessFailure=await readJob(job.id);
  await cancelJob(job.id);
  const cancelled=await readJob(job.id);
  await assert.rejects(prepareJob('replacement-after-lock',{operation:'run',plan:p},'new-turn'),/MATCHING_UNCERTAIN_WORK/);
  assert.equal(afterReadinessFailure.status,'uncertain');
  assert.equal(afterReadinessFailure.steps[0]!.status,'uncertain');
  assert.equal(cancelled.status,'cancelled');
  assert.equal(cancelled.steps[0]!.status,'uncertain');
 }finally{await rmdir(join(root,'desktop.lock'));}
});
test('denying a resumed file step preserves its earlier uncertainty and blocks a replacement',async()=>{
 const root=await setup();
 const p:WorkPlan={...plan,steps:[{kind:'file_change',action:'move',target:'latest',destination:'Archive'}]};
 const job=await prepareJob('uncertain-before-indexed-cancel',{operation:'run',plan:p},'turn');
 await acceptJob(job.id,true);await approveFileStep(job.id,0);
 await writeFile(join(root,'files',String(job.steps[0]!.input.name)),'Changed after approval');
 await assert.rejects(executeJobStep(job.id,0),/FILE_CHANGED/);
 await cancelJob(job.id,0);
 const cancelled=await readJob(job.id);
 assert.equal(cancelled.status,'cancelled');
 assert.equal(cancelled.steps[0]!.status,'uncertain');
 await assert.rejects(prepareJob('replacement-after-indexed-cancel',{operation:'run',plan:p},'new-turn'),/MATCHING_UNCERTAIN_WORK/);
 // Simulate a crash after recording a started step but before its outcome is known.
 await setup();
 const startedJob=await prepareJob('started-before-indexed-cancel',{operation:'run',plan:p},'turn');
 await acceptJob(startedJob.id,true);
 const interrupted=await readJob(startedJob.id);interrupted.steps[0]!.status='started';
 await(await import('../agent/lib/work.ts')).persistJob(interrupted);
 await cancelJob(startedJob.id,0);
 const startedCancelled=await readJob(startedJob.id);
 assert.equal(startedCancelled.status,'cancelled');
 assert.equal(startedCancelled.steps[0]!.status,'started');
 await assert.rejects(prepareJob('replacement-after-started-cancel',{operation:'run',plan:p},'new-turn'),/MATCHING_UNCERTAIN_WORK/);
});
