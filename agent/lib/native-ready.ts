import {nativeCli,nodes,one,scoped,snapshot,type NativeSnapshot,type NativeNode} from './native-cli.ts';
import {nativeProfile,callNativeWorker} from './native-worker.ts';
export function isNotesFolder(state:NativeSnapshot,folder:string){return state.complete&&state.tree.name===folder&&nodes(state).filter(n=>n.states?.includes('selected')&&exactFolderCell(n,folder)).length===1;}
function exactFolderCell(node:NativeNode,folder:string){
 if(node.role!=='cell'||typeof node.name!=='string')return false;
 if(node.name===`${folder}, 메모 없음`)return true;
 const prefix=`${folder}, `;
 return node.name.startsWith(prefix)&&/^(?:\d{1,3}(?:,\d{3})+|\d+)개의 메모$/.test(node.name.slice(prefix.length));
}
export async function sampleFoldersInSidebars(
 state:NativeSnapshot,
 folder:string,
 readSidebar:(outline:NativeNode)=>Promise<NativeSnapshot>=scoped,
):Promise<NativeNode[]>{
 const own:NativeNode[]=[];
 for(const outline of nodes(state).filter(n=>n.role==='outline')){
  const sidebar=await readSidebar(outline);
  if(sidebar.complete!==true)throw new Error('INCOMPLETE_NOTES_SIDEBAR');
  if(sidebar.tree.role!=='outline')throw new Error('INVALID_NOTES_SIDEBAR');
  own.push(...nodes(sidebar).filter(n=>exactFolderCell(n,folder)));
 }
 return own;
}
export async function prepareNativeNotes(){
 if((await callNativeWorker({operation:'desktop-state'})).frontmostBundleId==='com.apple.Notes')throw new Error('NOTES_APP_IN_USE: background recording is paused while Notes is the foreground app.');
 const permissions=await nativeCli(['permissions']);
 if(!permissions.ok||permissions.data?.accessibility?.state!=='granted')throw new Error('ACCESSIBILITY_PERMISSION_REQUIRED: enable Accessibility for the app that starts this server, then restart. No note was created.');
 const p=await nativeProfile();const read=(id:string)=>snapshot('notes',id);
 try{const current=await read(p.notesWindowId);if(current.window?.id!==p.notesWindowId)throw new Error('WINDOW_ID_MISMATCH');if(isNotesFolder(current,p.notesFolder))return current;}catch(error){if(!(error instanceof Error)||error.message!=='WINDOW_NOT_FOUND')throw error;}
 const launch=await nativeCli(['launch','com.apple.Notes']);if(!launch.ok)throw new Error(launch.error?.code??'NOTES_BACKGROUND_LAUNCH_FAILED');
 // Background launch returns when the process runs, before a window necessarily appears.
 let list=await nativeCli(['list-windows','--app','com.apple.Notes']);const readyDeadline=Date.now()+5000;
 while(list.ok&&Array.isArray(list.data)&&!list.data.some(w=>w?.accessible&&w?.visible&&!w?.minimized)&&Date.now()<readyDeadline){await new Promise(r=>setTimeout(r,100));list=await nativeCli(['list-windows','--app','com.apple.Notes']);}
 if(!list.ok)throw new Error(list.error?.code??'NOTES_WINDOW_LIST_FAILED');if(!Array.isArray(list.data))throw new Error('INVALID_NATIVE_WINDOW_LIST');
 const eligible=list.data.filter(w=>w&&w.accessible&&w.visible&&!w.minimized&&/^w-[\w-]+$/.test(w.id));if(eligible.length>10)throw new Error('TOO_MANY_NOTES_WINDOWS');
 const matches:{state:NativeSnapshot;folder?:NativeNode}[]=[];
 for(const window of eligible){
  let state:NativeSnapshot;try{state=await read(window.id);}catch(error){if(error instanceof Error&&error.message==='WINDOW_NOT_FOUND')continue;throw error;}
  if(state.window?.id!==window.id)throw new Error('WINDOW_ID_MISMATCH');
  if(isNotesFolder(state,p.notesFolder)){matches.push({state});continue;}
  // A large personal note list may truncate the whole window. It can locate a
  // sidebar ref, but only a complete scoped sidebar proves the folder target.
  const own=await sampleFoldersInSidebars(state,p.notesFolder);
  if(own.length>1)throw new Error('AMBIGUOUS_NOTES_SAMPLE_FOLDER');
  if(own.length===1)matches.push({state,folder:one(own)});
 }
 if(matches.length!==1)throw new Error(`NOTES_SAMPLE_WINDOW_REQUIRED: verified=${matches.length}, visible=${eligible.length}. No note was created; prepare the dedicated folder once.`);
 const target=matches[0]!;if(!target.folder)return target.state;
 if((await callNativeWorker({operation:'desktop-state'})).frontmostBundleId==='com.apple.Notes')throw new Error('NOTES_APP_IN_USE: automatic folder selection is paused while Notes is the foreground app.');
 const folder=await scoped(target.folder);await nativeCli(['click',folder.tree.ref_id!]);
 const deadline=Date.now()+5000;while(Date.now()<deadline){const after=await read(target.state.window!.id);if(isNotesFolder(after,p.notesFolder))return after;await new Promise(r=>setTimeout(r,100));}
 throw new Error('NOTES_SAMPLE_FOLDER_UNVERIFIED: no note was created.');
}
