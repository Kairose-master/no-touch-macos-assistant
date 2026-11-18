import { mkdir,readFile,realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { bundles, type ReminderInput } from './contracts.ts';
import { digest } from './storage.ts';
import { callNativeWorker, nativeProfile } from './native-worker.ts';
import { nativeCli,nodes, snapshot } from './native-cli.ts';

export async function nativeAddReminder(scope: string, input: ReminderInput) {
  const profile = await nativeProfile();
  const saved = await callNativeWorker({ operation: 'create-reminder', calendarId: profile.calendarId,
    title: `NoTouch Demo · ${input.title}`, dueAt: input.dueAt, timeZone: input.timeZone,
    operationId: digest({ scope, kind: 'native-reminder', input }) });
  const verified = await callNativeWorker({ operation: 'read-reminder', calendarId: profile.calendarId, reminderId: saved.reminderId });
  if (!verified.verified || !verified.hasAlarm || new Date(String(verified.dueAt)).getTime() !== new Date(input.dueAt).getTime() || verified.timeZone !== input.timeZone) throw new Error('REMINDER_COMMIT_UNVERIFIED');
  return { kind: 'reminder', title: String(verified.title), dueAt: input.dueAt, timeZone: input.timeZone,
    verified: true, mode: 'live', bundleId: bundles.reminders, transport: 'EventKit', reminderId: saved.reminderId, hasAlarm: true };
}
import {resolveWindow,discoverWindow} from './window-resolution.ts';
async function findFinderScope(pin:string,scopeName:string){
 const load=(id:string)=>snapshot('finder',id);const list=()=>nativeCli(['list-windows','--app','com.apple.finder']);const valid=(s:Awaited<ReturnType<typeof snapshot>>)=>s.tree.name==='files'&&nodes(s).some(n=>n.name===scopeName);
 try{return await resolveWindow(pin,load,list,valid);}catch(error){if(!(error instanceof Error)||!error.message.startsWith('PINNED_WINDOW_SCOPE_MISMATCH:'))throw error;return discoverWindow(load,list,valid);}
}
export async function nativeFinderSnapshot(){
 const p=await nativeProfile();const root=join(p.dataDirectory,'files');
 if(await realpath(root)!==root||await readFile(join(p.dataDirectory,'.no-touch-fixture'),'utf8')!=='no-touch-fixture-v1')throw new Error('UNSAFE_DEMO_ROOT');
 const scopeName='NoTouch-scope-'+digest({directory:root}).slice(0,32);const scopePath=join(root,scopeName);await mkdir(scopePath,{recursive:true,mode:0o700});if(await realpath(scopePath)!==scopePath)throw new Error('UNSAFE_DEMO_ROOT');
 await callNativeWorker({operation:'open-folder',folder:root});
 const deadline=Date.now()+5000;while(true){try{return await findFinderScope(p.finderWindowId,scopeName);}catch(error){if(!(error instanceof Error)||!/^PREPARED_WINDOW_NOT_FOUND:|^PINNED_WINDOW_SCOPE_MISMATCH:/.test(error.message)||Date.now()>deadline)throw error;await new Promise(r=>setTimeout(r,100));}}
}
export async function verifyFinderAbsent(name:string){
 let state=await nativeFinderSnapshot();const p=await nativeProfile();const scopeName='NoTouch-scope-'+digest({directory:join(p.dataDirectory,'files')}).slice(0,32);const deadline=Date.now()+5000;
 // Every readback must prove completeness, app/window identity and sample scope.
 // Re-observation never reissues the filesystem mutation.
 while(true){if(!nodes(state).some(n=>n.name===name))return;if(Date.now()>deadline)throw new Error('FINDER_RESULT_UNVERIFIED');await new Promise(r=>setTimeout(r,100));state=await findFinderScope(state.window!.id,scopeName);}
}
