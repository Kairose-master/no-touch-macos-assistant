import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,realpath,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {workPlan,resolveWhen,type WorkPlan} from '../agent/lib/work-contracts.ts';
import {prepareJob,acceptJob,executeJobStep,cancelJob,readJob,testRecipe,saveRecipe,approveFileStep} from '../agent/lib/work.ts';
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
 await acceptJob(job.id,true);const result=await executeJobStep(job.id,0);assert.deepEqual(await executeJobStep(job.id,0),result);
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
