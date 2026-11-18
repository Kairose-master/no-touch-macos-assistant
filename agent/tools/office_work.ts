import { defineWorkflowTool } from 'eve/tools';
import { FatalError } from 'eve/workflow';
import { workRequest, type WorkPlan, type WorkRequest } from '../lib/work-contracts.ts';
import type { Job } from '../lib/work.ts';
export default defineWorkflowTool({
 description:'Plan and execute a complete office request, or propose/test/save a reusable recipe. This is the required entry for real model work. Uses only scoped Notes, Reminders and sample Finder capabilities; never general code or app control. Every run previews its exact apps and inputs for human confirmation. Every move/trash/share additionally waits for an exact file approval. A saved recipe stores only validated data and a cards/compact layout, not executable code. Use tomorrow hour 15 Asia/Seoul for 내일 오후 3시, resolved by the server clock. A denied/cancelled job is final. Resume only its unchanged ID, never replace uncertain work with a new plan.',
 inputSchema:workRequest,
 async execute(request,ctx){
  'use workflow';
  const options=[{id:'approve',label:'이 계획 승인',style:'primary' as const},{id:'deny',label:'거절'}];
  if(request.operation==='save_recipe'){
    const proposal=await validateProposal(request.plan!);
    const answer=await ctx.ask({prompt:`업무 레시피 저장 전 검토\n${proposal.preview}\n\n격리 fixture 테스트 ${proposal.test.stepCount}단계 통과. 새 앱·권한·코드를 추가하지 않습니다. 저장만 하며 실제 앱은 실행하지 않습니다.`,display:'confirmation',options});
    if(answer.status!=='answered'||answer.optionId!=='approve')return {kind:'recipe',saved:false,rejected:true};
    return commitRecipe(request.plan!,proposal.test);
  }
  const job=await prepare(ctx.session.id,request,ctx.session.turn.id);
  if(job.status==='completed')return complete(job.id);
  if(job.status==='cancelled'||job.cancelRequested)return {kind:'work',...job};
  const approval=await ctx.ask({prompt:`${request.resumeJobId?'중단 작업 재개':'업무 실행 전 계획 확인'} · ${job.name}\n${job.preview}\n\n작업 ID ${job.id}\n완료된 단계는 재실행하지 않습니다. 불명확한 효과는 자동 반복하지 않습니다.`,display:'confirmation',options});
  if(approval.status!=='answered'||approval.optionId!=='approve')return cancel(job.id);
  await accept(job.id);
  for(let index=0;index<job.steps.length;index++){
    if(ctx.abortSignal.aborted)return cancel(job.id);
    const current=await inspect(job.id);
    if(current.cancelRequested)return complete(job.id);
    if(current.steps[index]!.status==='verified')continue;
    if(current.steps[index]!.kind==='file_change'){
      const prompt=await filePrompt(job.id,index);
      const answer=await ctx.ask({prompt,display:'confirmation',options:[{id:'approve',label:'이 파일 변경 승인',style:'primary'},{id:'deny',label:'거절'}]});
      if(answer.status!=='answered'||answer.optionId!=='approve')return cancel(job.id,index);
      await approveFile(job.id,index);
    }
    await executeStep(job.id,index);
  }
  return complete(job.id);
 },
});
async function prepare(sessionId:string,request:WorkRequest,executionKey:string){'use step';try{return await(await import('../lib/work.ts')).prepareJob(sessionId,request,executionKey);}catch(error){throw new FatalError(error instanceof Error?error.message:'WORK_PREPARE_FAILED');}}
async function inspect(id:string){'use step';return(await import('../lib/work.ts')).readJob(id);}
async function accept(id:string){'use step';return(await import('../lib/work.ts')).acceptJob(id,true);}
async function executeStep(id:string,index:number){'use step';try{return await(await import('../lib/work.ts')).executeJobStep(id,index);}catch(error){throw new FatalError(error instanceof Error?error.message:'WORK_OUTCOME_UNCERTAIN');}}
async function filePrompt(id:string,index:number){'use step';return(await import('../lib/work.ts')).stepChangePreview(id,index);}
async function approveFile(id:string,index:number){'use step';return(await import('../lib/work.ts')).approveFileStep(id,index);}
async function complete(id:string){'use step';return(await import('../lib/work.ts')).finishJob(id);}
async function cancel(id:string,index?:number){'use step';return(await import('../lib/work.ts')).cancelJob(id,index);}
async function validateProposal(plan:WorkPlan){'use step';const w=await import('../lib/work.ts');return{preview:w.planPreview(plan),test:await w.testRecipe(plan)};}
async function commitRecipe(plan:WorkPlan,test:{passed:boolean;stepCount:number}){'use step';return(await import('../lib/work.ts')).saveRecipe(plan,test);}
