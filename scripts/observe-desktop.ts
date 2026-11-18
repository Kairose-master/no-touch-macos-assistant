import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
export async function observeDesktop(){
 const child=spawn(resolve('.native-build/NoTouchObserver'),[],{shell:false,stdio:['pipe','pipe','pipe']});let text='';let final:Record<string,unknown>|undefined;
 let ready!:(value:void)=>void;let fail!:(reason:Error)=>void;
 const started=new Promise<void>((accept,reject)=>{ready=accept;fail=reject;});
 let finish!:(value:Record<string,unknown>)=>void;let finishFail!:(reason:Error)=>void;const finished=new Promise<Record<string,unknown>>((accept,reject)=>{finish=accept;finishFail=reject;});
 child.stderr.resume();child.stdout.on('data',data=>{text+=data.toString();let index;while((index=text.indexOf('\n'))>=0){const line=text.slice(0,index);text=text.slice(index+1);try{const item=JSON.parse(line);if(item.ready)ready();else final=item;}catch{fail(new Error('Invalid desktop observation output'));}}});
 child.on('error',error=>{fail(error);finishFail(error);});child.on('close',()=>{if(final)finish(final);else{const error=new Error('Desktop observation ended without a report');fail(error);finishFail(error);}});
 // Attach rejection handler before the browser flow starts, and fail before any mutation if unavailable.
 finished.catch(()=>{});
 let startupTimer:ReturnType<typeof setTimeout>|undefined;
 try { await Promise.race([started,new Promise((_,reject)=>{startupTimer=setTimeout(()=>{child.kill();reject(new Error('Desktop observer unavailable: build:native required'));},5000);startupTimer.unref();})]); }
 finally { if(startupTimer)clearTimeout(startupTimer); }
 return {async stop(){if(child.exitCode===null)child.stdin.end('stop\n');return finished;}};
}
