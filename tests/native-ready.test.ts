import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleFoldersInSidebars } from '../agent/lib/native-ready.ts';
import type { NativeNode, NativeSnapshot } from '../agent/lib/native-cli.ts';

const folder='NoTouch Demo API';
function cell(name:string,ref='@sidebar:e1'):NativeNode{return{role:'cell',name,ref_id:ref};}
function state(tree:NativeNode,complete=true):NativeSnapshot{return{app:'메모',snapshot_id:'sample',complete,tree};}
function outline(ref='@window:e1',children:NativeNode[]=[]):NativeNode{return{role:'outline',ref_id:ref,children};}

test('incomplete whole window locates a sidebar but only a complete scoped sidebar proves the folder',async()=>{
 const sidebar=outline();const target=cell(`${folder}, 3개의 메모`);let reads=0;
 const result=await sampleFoldersInSidebars(state({role:'window',children:[sidebar]},false),folder,async node=>{
  reads++;assert.equal(node,sidebar);return state(outline('@scoped:e1',[target]));
 });
 assert.deepEqual(result,[target]);assert.equal(reads,1);
});

test('incomplete scoped sidebar fails even when it contains an exact sample folder cell',async()=>{
 await assert.rejects(sampleFoldersInSidebars(state({role:'window',children:[outline()]},false),folder,async()=>state(outline('@scoped:e1',[cell(`${folder}, 메모 없음`)]),false)),/INCOMPLETE_NOTES_SIDEBAR/);
});

test('folder occurrences across complete scopes retain their count for caller ambiguity checks',async()=>{
 const target=cell(`${folder}, 메모 없음`);
 const result=await sampleFoldersInSidebars(state({role:'window',children:[outline('@window:e1'),outline('@window:e2')]}),folder,async()=>state(outline('@scoped:e1',[target])));
 assert.equal(result.length,2);assert.deepEqual(result,[target,target]);
});

test('only exact folder labels in outline scopes match, without treating note content as folders',async()=>{
 const body:NativeNode={role:'textfield',name:`${folder}, 2개의 메모`,value:`${folder}, 메모 없음`};
 const whole=state({role:'window',children:[cell(`${folder}, 메모 없음`),body,outline()]},false);
 const result=await sampleFoldersInSidebars(whole,folder,async()=>state(outline('@scoped:e1',[
  cell(`${folder} Extra, 2개의 메모`),cell(`${folder}, private folder, 2개의 메모`),
  cell(`${folder}, arbitrary note text`),body,
 ])));
 assert.deepEqual(result,[]);
 const targets=[cell(`${folder}, 메모 없음`,'@scoped:e2'),cell(`${folder}, 1,234개의 메모`,'@scoped:e3')];
 assert.deepEqual(await sampleFoldersInSidebars(whole,folder,async()=>state(outline('@scoped:e1',targets))),targets);
});

test('whole-window body cells never become folder targets when there is no outline',async()=>{
 const result=await sampleFoldersInSidebars(state({role:'window',children:[cell(`${folder}, 메모 없음`)]}),folder,async()=>{throw new Error('must not read a note body as a sidebar');});
 assert.deepEqual(result,[]);
});

test('sidebar read errors and a mismatched scoped root stop discovery',async()=>{
 const window=state({role:'window',children:[outline()]});const denied=new Error('ACCESSIBILITY_PERMISSION_DENIED');
 await assert.rejects(sampleFoldersInSidebars(window,folder,async()=>{throw denied;}),error=>error===denied);
 await assert.rejects(sampleFoldersInSidebars(window,folder,async()=>state({role:'textfield',name:folder})),/INVALID_NOTES_SIDEBAR/);
});
