import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir, lstat, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { once as eventOnce } from 'node:events';
import { Client } from 'eve/client';
import { emptySessionView, foldEvents, openInteractions } from 'eve/events';
import { seed } from './seed.ts';

const root = resolve('.demo', `integration-${crypto.randomUUID()}`);
await seed(root);
const port = 2100; const baseUrl = `http://127.0.0.1:${port}`;
const client = new Client({ baseUrl });
let server: ChildProcess | undefined; let logs = '';
async function start() {
  logs = '';
  server = spawn(resolve('node_modules/.bin/eve'), ['dev','--no-ui','--resume','--no-default-extensions','--host','127.0.0.1','--port',String(port)], {
    env: { ...process.env, NO_TOUCH_MODE:'fixture', NO_TOUCH_MODEL:'rehearsal', NO_TOUCH_DATA_DIR:root, EVE_TELEMETRY_DISABLED:'1' }, stdio:['ignore','pipe','pipe'],
  });
  server.stdout!.on('data', data => { logs += String(data); }); server.stderr!.on('data', data => { logs += String(data); });
  const until = Date.now() + 35000;
  while (Date.now() < until) {
    if (server.exitCode !== null) throw new Error(`eve exited: ${logs}`);
    try { await client.health(); return; } catch { await new Promise(r => setTimeout(r, 200)); }
  }
  throw new Error(`eve startup timeout: ${logs}`);
}
async function stop() {
  if (!server || server.exitCode !== null) return;
  const exited = eventOnce(server, 'exit'); server.kill('SIGTERM');
  await Promise.race([exited, new Promise((_, reject) => { const t = setTimeout(() => { server?.kill('SIGKILL'); reject(new Error('eve did not stop')); }, 10000); t.unref(); })]);
}
const signal = () => AbortSignal.timeout(20000);
async function request(action: string) {
  const created = await client.sessions.create({ message: `샘플 회의 메모, 서울 시간 알림, 최신 파일 카드와 ${action}` });
  const waiting = await created.delivery.result({ signal: signal() });
  assert.equal(waiting.outcome, 'awaiting-input'); assert.equal(waiting.interactions.length, 1);
  const interaction = waiting.interactions[0]!;
  assert.equal(interaction.request.kind, 'approval');
  const input = interaction.call!.input as { name: string; destination: string };
  await lstat(join(root, 'files', input.name));
  return { ...created, interaction, input };
}
try {
  await start();
  const info = await client.info();
  assert.ok(JSON.stringify(info).includes('change_file'));
  const move = await request('이동');
  await assert.rejects(lstat(join(root,'files','Archive',move.input.name)), { code:'ENOENT' });
  const initialState = JSON.parse(await readFile(join(root,'apps.json'),'utf8'));
  assert.equal(initialState.notes.length, 1); assert.equal(initialState.reminders.length, 1);
  await stop(); await start();
  const restored = client.sessions.attach(move.session.id);
  const snapshot = await restored.snapshot({ signal: signal() });
  const open = openInteractions(foldEvents(emptySessionView(), snapshot.events));
  assert.equal(open[0]?.interactionId, move.interaction.interactionId);
  const answer = { answers: [{ interactionId: move.interaction.interactionId, optionId: 'approve' }], idempotencyKey: `approve-${crypto.randomUUID()}` };
  async function postAnswer() {
    const response = await client.fetch(`/eve/v1/session/${restored.id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(answer), signal: signal() });
    assert.ok(response.status === 200 || response.status === 202); return await response.json() as { deliveryId: string };
  }
  const approved = await postAnswer();
  const duplicate = await postAnswer(); assert.equal(duplicate.deliveryId, approved.deliveryId);
  const until = Date.now() + 20000;
  while (true) {
    try { await lstat(join(root,'files','Archive',move.input.name)); break; }
    catch { if (Date.now() > until) throw new Error('Approved move did not complete'); await new Promise(r => setTimeout(r,100)); }
  }
  await assert.rejects(lstat(join(root,'files',move.input.name)), { code:'ENOENT' });
  const recovered = JSON.parse(await readFile(join(root,'apps.json'),'utf8'));
  assert.equal(recovered.notes.length,1); assert.equal(recovered.reminders.length,1);
  const denied = await request('삭제');
  const denial = await denied.session.respond([{ interactionId:denied.interaction.interactionId, optionId:'deny' }]);
  assert.equal((await denial.result({ signal:signal() })).outcome,'handled');
  await lstat(join(root,'files',denied.input.name)); await assert.rejects(lstat(join(root,'files','Trash',denied.input.name)), { code:'ENOENT' });
  const shared = await request('공유');
  await (await shared.session.respond([{ interactionId:shared.interaction.interactionId, optionId:'approve' }])).result({ signal:signal() });
  const preview = JSON.parse(await readFile(join(root,'files','.share-preview',`${shared.input.name}.json`),'utf8'));
  assert.equal(preview.externalDelivery,false); await lstat(join(root,'files',shared.input.name));
  const trashed = await request('삭제');
  await (await trashed.session.respond([{ interactionId:trashed.interaction.interactionId, optionId:'approve' }])).result({ signal:signal() });
  await lstat(join(root,'files','Trash',trashed.input.name));
  const report = { passed:true, eve:'1.0.2', mode:'fixture', approvalBeforeEffect:true, restartResume:true, exactInteractionRestored:true, approvalResponseDeduplicated:true, creationNotRepeatedAfterRestart:true, denialHasNoFileEffect:true, approvedMove:true, approvedReversibleTrash:true, shareIsLocalPreview:true, nativeMacOSE2E:false };
  await mkdir('docs/evidence',{recursive:true}); await writeFile('docs/evidence/integration-result.json',JSON.stringify(report,null,2)+'\n'); console.log(JSON.stringify(report,null,2));
} finally { await stop(); }
