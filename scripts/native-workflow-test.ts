import assert from 'node:assert/strict';
import {spawn,type ChildProcess} from 'node:child_process';
import {once} from 'node:events';
import {open,readFile,lstat,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {chromium} from '@playwright/test';
import {Client} from 'eve/client';
import {nativeProfile,callNativeWorker} from '../agent/lib/native-worker.ts';
import {readJson} from '../agent/lib/storage.ts';
import {snapshot,nodes} from '../agent/lib/native-cli.ts';
import {observeDesktop} from './observe-desktop.ts';
process.env.NO_TOUCH_MODE='live';process.env.NO_TOUCH_MODEL='chatgpt';
const p=await readJson<{dataDirectory:string}>('.demo-native/profile.json',{dataDirectory:''});process.env.NO_TOUCH_DATA_DIR=p.dataDirectory;const profile=await nativeProfile();const root=profile.dataDirectory;
await lstat(join(root,'files','demo-brief.md'));await assert.rejects(lstat(join(root,'files','Archive','demo-brief.md')),{code:'ENOENT'});
const client=new Client({baseUrl:'http://127.0.0.1:2000'});let server:ChildProcess|undefined;
async function start(){const log=await open(join(root,'workflow-restart.log'),'a',0o600);server=spawn(process.execPath,['--experimental-strip-types','scripts/run-live.ts'],{env:process.env,stdio:['ignore',log.fd,log.fd]});server.on('close',()=>void log.close());const until=Date.now()+45000;while(true){if(server.exitCode!==null)throw new Error('Live server exited');try{await client.health();const r=await fetch('http://127.0.0.1:3000');if(r.ok)return;}catch{}if(Date.now()>until)throw new Error('Live server readiness timeout');await new Promise(r=>setTimeout(r,200));}}
async function stop(){if(server&&server.exitCode===null){const exited=once(server,'exit');server.kill('SIGTERM');await exited;}}
async function noteCount(){const state=await snapshot('notes',profile.notesWindowId);assert.equal(state.tree.name,profile.notesFolder);const cell=nodes(state).find(n=>n.role==='cell'&&n.states?.includes('selected')&&n.name?.startsWith(profile.notesFolder+','));const count=cell?.name?.match(/, ([0-9,]+)개의 메모$/)?.[1];assert.ok(count);return Number(count.replaceAll(',',''));}
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1280,height:1050},locale:'ko-KR',timezoneId:'Asia/Seoul'});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));let monitor:Awaited<ReturnType<typeof observeDesktop>>|undefined;let measured=false;
try{
 await start();const countBefore=await noteCount();monitor=await observeDesktop();
 await page.goto('http://127.0.0.1:3000');
 await page.getByLabel('복합 요청').fill('재시작 검증 메모라는 새 메모를 만들어 줘. 본문은 승인 재개를 검증한다야. 내일 오후 3시 서울에 재시작 검증 알림도 추가해 줘. 최근 파일을 보여 준 다음 샘플 demo-brief.md를 Archive로 이동해 줘. 전체 계획과 파일 변경은 각각 승인받아 줘.');
 await page.getByRole('button',{name:'요청 보내기'}).click();const plan=page.getByRole('button',{name:'이 계획 승인',exact:true});await plan.waitFor({timeout:90000});const prompt=await page.locator('.nt-approval').innerText();const jobId=prompt.match(/작업 ID ([a-f0-9]{64})/)![1]!;assert.ok(prompt.includes('demo-brief.md'));assert.equal(await noteCount(),countBefore);await plan.click();
 const fileApproval=page.getByRole('button',{name:'이 파일 변경 승인',exact:true});await fileApproval.waitFor({timeout:90000});const sessionURL=page.url();const originalPreview=await page.locator('.nt-approval').innerText();
 assert.equal(await noteCount(),countBefore+1);await lstat(join(root,'files','demo-brief.md'));
 const jobBefore=JSON.parse(await readFile(join(root,'jobs',jobId+'.json'),'utf8'));const reminderId=jobBefore.steps[1].output.reminderId;assert.equal(jobBefore.steps[0].status,'verified');assert.equal(jobBefore.steps[1].status,'verified');
 await page.screenshot({path:'docs/evidence/native-workflow-paused.png',fullPage:true});
 await stop();await start();await page.goto(sessionURL);await fileApproval.waitFor({timeout:45000});assert.equal(await page.locator('.nt-approval').innerText(),originalPreview);assert.equal(await noteCount(),countBefore+1);
 const persisted=JSON.parse(await readFile(join(root,'jobs',jobId+'.json'),'utf8'));assert.equal(persisted.steps[1].output.reminderId,reminderId);await callNativeWorker({operation:'read-reminder',calendarId:profile.calendarId,reminderId});
 await fileApproval.click();await page.locator('.nt-job h3').filter({hasText:/completed/}).waitFor({timeout:90000});await lstat(join(root,'files','Archive','demo-brief.md'));await assert.rejects(lstat(join(root,'files','demo-brief.md')),{code:'ENOENT'});assert.equal(await noteCount(),countBefore+1);
 console.log('Real native work: same file approval survived restart; note/reminder not repeated; approved move verified.');
 // A new model-authored recipe is tested before save, and saving alone must not write to apps.
 await page.goto('http://127.0.0.1:3000');await page.getByLabel('복합 요청').fill('새 업무 레시피를 만들어 저장하고 싶어. 이름은 간단한 회의 후속 업무야. 단계는 새 메모 제목 레시피 실행 검증, 본문 샘플 회의 후속을 정리한다; 내일 오후 3시 서울에 레시피 준비 알림 생성; 최근 파일 조회 순서야. 화면은 compact로 해줘. 아직 앱은 실행하지 말고 격리 테스트 후 저장 승인을 받아줘.');await page.getByRole('button',{name:'요청 보내기'}).click();await plan.waitFor({timeout:90000});assert.match(await page.locator('.nt-approval').innerText(),/격리 fixture 테스트 3단계 통과/);assert.equal(await noteCount(),countBefore+1);await page.screenshot({path:'docs/evidence/recipe-review.png',fullPage:true});await plan.click();await page.getByRole('button',{name:'이 레시피 실행',exact:true}).waitFor({timeout:45000});assert.equal(await noteCount(),countBefore+1);
 // Wait for the real model's save summary before starting a new turn in the same session.
 await page.locator('footer span').filter({hasText:/준비됨/}).waitFor({timeout:45000});await page.getByRole('button',{name:'이 레시피 실행',exact:true}).click();await plan.waitFor({timeout:90000});await plan.click();await page.locator('.nt-job.compact h3').filter({hasText:/completed/}).waitFor({timeout:90000});assert.equal(await noteCount(),countBefore+2);await page.screenshot({path:'docs/evidence/recipe-native-completed.png',fullPage:true});
 const observation=await monitor.stop();measured=true;assert.equal(observation.focusUnchangedThroughout,true);assert.equal(observation.cursorUnchangedThroughout,true);assert.deepEqual(errors,[]);
 const report={passed:true,date:'2026-11-18',mode:'live',model:'real ChatGPT subscription',nativeWritesBeforeRestartVerified:true,sameFileApprovalRestored:true,noteNotDuplicatedAfterRestart:true,reminderIdUnchangedAfterRestart:true,explicitFileApprovalAfterRestart:true,scopedMoveAndFinderReadback:true,modelAuthoredRecipe:true,isolatedFixtureRecipeTest:true,recipeSaveApproval:true,savingRecipeDoesNotRunApps:true,savedRecipeNativeRun:true,compactLayoutApplied:true,...observation,pageErrors:errors};await writeFile('docs/evidence/native-workflow-result.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}catch(error){await page.screenshot({path:join(root,'workflow-test-failure.png'),fullPage:true});console.error((await page.locator('body').innerText()).slice(-7000));throw error;}finally{if(monitor&&!measured)await monitor.stop();await browser.close();await stop();}
