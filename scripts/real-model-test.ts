import assert from 'node:assert/strict';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {chromium} from '@playwright/test';
import {nativeProfile} from '../agent/lib/native-worker.ts';
import {readJson} from '../agent/lib/storage.ts';
import {snapshot,nodes} from '../agent/lib/native-cli.ts';
import {resolveWhen} from '../agent/lib/work-contracts.ts';
import {observeDesktop} from './observe-desktop.ts';
process.env.NO_TOUCH_MODE='live';
const p=await readJson<{dataDirectory:string}>('.demo-native/profile.json',{dataDirectory:''});process.env.NO_TOUCH_DATA_DIR=p.dataDirectory;
const profile=await nativeProfile();
async function count(){const state=await snapshot('notes',profile.notesWindowId);assert.equal(state.tree.name,profile.notesFolder);const cell=nodes(state).find(n=>n.role==='cell'&&n.states?.includes('selected')&&n.name?.startsWith(profile.notesFolder+','));assert.ok(cell);const match=cell.name!.match(/, ([0-9,]+)개의 메모$/);assert.ok(match);return Number(match[1]!.replaceAll(',',''));}
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1280,height:1050},locale:'ko-KR',timezoneId:'Asia/Seoul'});const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
const trials=[]; const runTag=new Date().toISOString().slice(11,19);
try{
 for(let trial=1;trial<=Number(process.env.NO_TOUCH_TEST_TRIALS??3);trial++){
  const before=await count();const monitor=await observeDesktop();let stopped=false;
  try{
   await page.goto('http://127.0.0.1:3000');await page.getByText(/ChatGPT 구독 모델이 요청을 계획합니다/).waitFor();
   await page.getByLabel('복합 요청').fill(`회의 메모 만들고, 내일 오후 3시(서울)에 알림 추가하고, 최근 파일 보여줘. 메모 제목은 모델 웹 회의 검증 ${trial} (${runTag}), 본문은 다음 회의 데모를 준비한다야. 알림 제목은 모델 웹 준비 알림 ${trial} (${runTag})로 해줘. 파일 변경은 하지 마.`);
   await page.getByRole('button',{name:'요청 보내기'}).click();
   const approve=page.getByRole('button',{name:'이 계획 승인',exact:true});await approve.waitFor({timeout:90000});
   const preview=await page.locator('.nt-approval').innerText();assert.match(preview,/com.apple.Notes/);assert.match(preview,/com.apple.reminders/);assert.match(preview,/com.apple.finder/);
   const expected=resolveWhen({kind:'tomorrow',hour:15,minute:0,timeZone:'Asia/Seoul'},new Date());assert.ok(preview.includes(expected.dueAt));
   assert.equal(await count(),before,'Plan preview must not create a note');
   await approve.click();
   await page.locator('.nt-job h3').filter({hasText:/completed/}).waitFor({timeout:90000});
   await page.getByText(/실제 Mac · 메모 내용 재조회 확인/).waitFor();await page.getByText(/실제 Mac · 일정 재조회 확인/).waitFor();
   assert.equal(await count(),before+1,'Exactly one new sample note per compound request');
   const jobId=(await page.locator('.nt-job > small').innerText()).match(/[a-f0-9]{64}/)![0];
   const job=JSON.parse(await readFile(join(profile.dataDirectory,'jobs',`${jobId}.json`),'utf8'));
   assert.equal(job.status,'completed');assert.deepEqual(job.steps.map((s:{kind:string})=>s.kind),['note','reminder','files']);assert.ok(job.steps.every((s:{status:string})=>s.status==='verified'));
   assert.equal(job.steps[1].output.dueAt,expected.dueAt);assert.equal(job.steps[1].output.transport,'EventKit');assert.ok(job.steps[2].output.cards.length>0);
   const observation=await monitor.stop();stopped=true;await writeFile(join(profile.dataDirectory,'last-observation.json'),JSON.stringify(observation));console.log(JSON.stringify({trial,...observation}));assert.equal(observation.focusUnchangedThroughout,true);assert.equal(observation.cursorUnchangedThroughout,true);
   trials.push({trial,passed:true,noteCreatedOnce:true,reminderDateTimeZoneAlarmReadback:true,serverResolvedTomorrow:true,renderedNativeResults:true,...observation});
   if(trial===1)await page.screenshot({path:'docs/evidence/real-model-web-completed.png',fullPage:true});
   console.log(`Real model web → three Mac apps trial ${trial}: passed`);
  }finally{if(!stopped)await monitor.stop();}
 }
 assert.deepEqual(errors,[]);
 const report={passed:true,date:'2026-11-18',model:'eve chatgpt() / ChatGPT subscription real model',scriptedModel:false,mode:'live',request:'회의 메모 만들고, 내일 오후 3시 서울 알림 추가하고, 최근 파일 보여줘',planApprovalBeforeAnyWrite:true,nativeThreeAppWebE2E:true,continuousActivationObservation:true,cursorSampleIntervalMs:25,trials,pageErrors:errors};
 await writeFile('docs/evidence/real-model-result.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}catch(error){await page.screenshot({path:join(profile.dataDirectory,'real-model-test-failure.png'),fullPage:true});console.error((await page.locator('body').innerText()).slice(-7000));throw error;}finally{await browser.close();}
