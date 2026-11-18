import test from 'node:test';
import assert from 'node:assert/strict';
import { findPreparedNotesWindow, preparedNotesFolder } from '../scripts/native-window.ts';
import type { NativeNode, NativeSnapshot } from '../agent/lib/native-cli.ts';
const folder = 'NoTouch Demo API';
function state(id = 'w-main', selected = true): NativeSnapshot {
  const cell: NativeNode = {role:'cell',name:folder+', 2개의 메모',states:selected?['selected']:[]};
  return { app:'메모', snapshot_id:'test', complete:true, window:{id}, tree:{role:'window',name:folder,children:[cell]} };
}
const list = (ids = ['w-main']) => async () => ({ok:true,data:ids.map(id=>({id,title:'A note title rather than its folder',accessible:true,visible:true}))});
test('Notes setup uses the selected AX folder even when the window list title differs', async () => {
  assert.equal(await findPreparedNotesWindow(folder,list(),async id=>state(id)),'w-main');
});
test('Notes setup rejects unselected folders, floating notes, incomplete snapshots and wrong window IDs', async () => {
  assert.equal(preparedNotesFolder(state('w-main',false),folder),false);
  assert.equal(preparedNotesFolder({...state(),complete:false},folder),false);
  assert.equal(preparedNotesFolder({...state(),tree:{role:'window',name:folder}},folder),false);
  await assert.rejects(findPreparedNotesWindow(folder,list(),async id=>state(id,false)),/verified=0/);
  await assert.rejects(findPreparedNotesWindow(folder,list(),async()=>state('w-other')),/NATIVE_WINDOW_MISMATCH/);
});
test('Notes setup never chooses between two validated sample windows',async()=>{
  await assert.rejects(findPreparedNotesWindow(folder,list(['w-one','w-two']),async id=>state(id)),/verified=2/);
});
test('Notes setup preserves permission/list errors instead of reporting no matching title',async()=>{
  await assert.rejects(findPreparedNotesWindow(folder,async()=>({ok:false,error:{code:'ACCESSIBILITY_PERMISSION_DENIED'}}),async()=>state()),/ACCESSIBILITY_PERMISSION_DENIED/);
  await assert.rejects(findPreparedNotesWindow(folder,async()=>({ok:true,data:{}}),async()=>state()),/INVALID_NATIVE_WINDOW_LIST/);
});
