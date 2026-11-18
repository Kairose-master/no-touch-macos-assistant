import {nativeCli,nodes,one,scoped,snapshot,type NativeSnapshot,type NativeNode} from './native-cli.ts';
import {nativeProfile,callNativeWorker} from './native-worker.ts';
import {recoverNotesWindows} from './notes-window-recovery.ts';
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
export async function assertNotesBackground(){
 if((await callNativeWorker({operation:'desktop-state'})).frontmostBundleId==='com.apple.Notes')throw new Error('NOTES_APP_IN_USE: background recording is paused while Notes is the foreground app.');
}
async function readyWhileBackground(state:NativeSnapshot){await assertNotesBackground();return state;}
export async function prepareNativeNotes(){
 await assertNotesBackground();
 const permissions=await nativeCli(['permissions']);
 if(!permissions.ok||permissions.data?.accessibility?.state!=='granted')throw new Error('ACCESSIBILITY_PERMISSION_REQUIRED: enable Accessibility for the app that starts this server, then restart. No note was created.');
 const p=await nativeProfile();const read=(id:string)=>snapshot('notes',id);
 try{const current=await read(p.notesWindowId);if(current.window?.id!==p.notesWindowId)throw new Error('WINDOW_ID_MISMATCH');if(isNotesFolder(current,p.notesFolder))return readyWhileBackground(current);}catch(error){if(!(error instanceof Error)||error.message!=='WINDOW_NOT_FOUND')throw error;}
 const eligible=await recoverNotesWindows();
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
 if(matches.length!==1)throw new Error(`NOTES_SAMPLE_WINDOW_REQUIRED: verified=${matches.length}, visible=${eligible.length}. No note write was dispatched. Background preparation could not prove one dedicated folder; keep this job and inspect its readiness.`);
 const target=matches[0]!;if(!target.folder)return readyWhileBackground(target.state);
 await assertNotesBackground();
 const folder=await scoped(target.folder);await nativeCli(['click',folder.tree.ref_id!]);
 const deadline=Date.now()+5000;while(Date.now()<deadline){const after=await read(target.state.window!.id);if(isNotesFolder(after,p.notesFolder))return readyWhileBackground(after);await new Promise(r=>setTimeout(r,100));}
 throw new Error('NOTES_SAMPLE_FOLDER_UNVERIFIED: no note was created.');
}
