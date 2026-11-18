import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, realpath, readFile, writeFile, symlink, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Desktop, unique, validateArgs, type Envelope, type Transport } from '../agent/lib/desktop.ts';
import { toolPolicy, changeInput, reminderInput } from '../agent/lib/contracts.ts';
import { once } from '../agent/lib/storage.ts';
import { seed } from '../scripts/seed.ts';
import { writeNote, addReminder, latestFiles, changeFile } from '../agent/lib/office.ts';

const windows = { notes: 'w-1', reminders: 'w-2', finder: 'w-3' };
function snapshot(id: number, names = ['New Note'], value = ''): Envelope {
  return { ok: true, data: { app: 'com.apple.Notes', snapshot_id: `s${id}`, complete: true, tree: { role: 'window', children: names.map((name, index) => ({ role: 'button', name, value, ref_id: `@s${id}:e${index + 1}` })) } } };
}
test('headless boundary rejects physical input, focus, arbitrary apps, old refs and extra flags', () => {
  for (const args of [['press','cmd+n'], ['focus','@s1:e1'], ['launch','Notes'], ['focus-window','w-1'], ['click','@e1'], ['click','@s1:e1','--headed'], ['snapshot','--app','Mail','-i']]) assert.throws(() => validateArgs(args));
  validateArgs(['type','@s1:e1','--stdin'], 'hello');
  validateArgs(['set-value','@s1:e1','--stdin'], 'hello');
  for (const name of ['bash','write_file','edit_file','agent','desktop_click','connection__delete']) assert.equal(toolPolicy(name)?.type, 'denied');
  assert.equal(toolPolicy('latest_files'), undefined);
});
test('ambiguous selectors and incomplete trees fail closed', () => {
  assert.throws(() => unique(snapshot(1, ['New Note', 'New Note']).data!, { role: 'button', name: 'New Note' }), /AMBIGUOUS/);
  assert.throws(() => unique({ ...snapshot(1).data!, complete: false }, { role: 'button', name: 'New Note' }), /INCOMPLETE/);
});
for (const code of ['STALE_REF','AMBIGUOUS_TARGET']) test(`${code} is reobserved and retried once only when explicitly safe`, async () => {
  let reads = 0; const refs: string[] = [];
  const transport: Transport = { async run(args) {
    if (args[0] === 'snapshot') return snapshot(++reads, ['New Note'], refs.length > 1 ? 'done' : '');
    refs.push(args[1]!);
    if (refs.length === 1) return { ok: false, error: { code, disposition: { delivery: 'not_delivered', retry: 'safe' } } };
    return { ok: true };
  } };
  await new Desktop(transport, windows).act('notes', { role: 'button', name: 'New Note' }, 'click', s => s.tree.children?.[0]?.value === 'done');
  assert.deepEqual(refs, ['@s1:e1','@s3:e1']); assert.equal(reads, 4);
});
test('uncertain delivery is observed but never repeated; observed success is accepted', async () => {
  for (const verified of [false, true]) {
    let reads = 0; let actions = 0;
    const transport: Transport = { async run(args) { if (args[0] === 'snapshot') return snapshot(++reads, ['New Note'], reads > 1 && verified ? 'done' : ''); actions++; return { ok: false, error: { code: 'TIMEOUT', disposition: { delivery: 'possibly_delivered', retry: 'unsafe' } } }; } };
    const operation = new Desktop(transport, windows).act('notes', { role: 'button', name: 'New Note' }, 'click', s => s.tree.children?.[0]?.value === 'done');
    if (verified) await operation; else await assert.rejects(operation);
    assert.equal(actions, 1); assert.equal(reads, 2);
  }
});
test('ledger prevents duplicate writes across repeat calls, concurrent calls and interrupted effects', async () => {
  process.env.NO_TOUCH_DATA_DIR = await realpath(await mkdtemp(join(tmpdir(), 'no-touch-ledger-')));
  let writes = 0;
  assert.equal(await once('a','note',{}, async () => ++writes), 1);
  assert.equal(await once('a','note',{}, async () => ++writes), 1);
  await assert.rejects(once('a','crash',{}, async () => { throw new Error('interrupted'); }));
  await assert.rejects(once('a','crash',{}, async () => ++writes), /OUTCOME_UNCERTAIN/);
  const calls = await Promise.allSettled([once('a','concurrent',{}, async () => ++writes), once('a','concurrent',{}, async () => ++writes)]);
  assert.equal(writes, 2); assert.ok(calls.some(c => c.status === 'fulfilled'));
});
test('isolated office workflow verifies records, fingerprints, move, reversible trash and local preview', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'no-touch-office-'))); process.env.NO_TOUCH_DATA_DIR = root; process.env.NO_TOUCH_MODE = 'fixture'; await seed(root);
  const note = { title: 'Test', body: 'Only sample data' };
  await writeNote('one', note); await writeNote('one', note);
  await addReminder('one', reminderInput.parse({ title: 'Test reminder', dueAt: '2026-11-19T15:00:00+09:00', timeZone: 'Asia/Seoul' }));
  const state = JSON.parse(await readFile(join(root, 'apps.json'), 'utf8')); assert.equal(state.notes.length, 1); assert.equal(state.reminders.length, 1);
  const cards = (await latestFiles()).cards; assert.equal(cards[0]?.name, 'budget-sample.csv');
  await writeFile(cards[0]!.path, 'changed');
  await assert.rejects(changeFile('one', changeInput.parse({ action: 'move', name: cards[0]!.name, fingerprint: cards[0]!.fingerprint, destination: 'Archive' })), /FILE_CHANGED/);
  for (const action of ['move','trash','share'] as const) {
    const card = (await latestFiles()).cards[0]!;
    const destination = { move: 'Archive', trash: 'Trash', share: 'Local share preview' }[action];
    const result = await changeFile('two', changeInput.parse({ action, name: card.name, fingerprint: card.fingerprint, destination })); assert.equal(result.verified, true); assert.equal(result.externalDelivery, false);
    if (action !== 'share') await assert.rejects(lstat(card.path), { code: 'ENOENT' });
  }
  await symlink('/etc/hosts', join(root, 'files', 'private-link'));
  assert.ok(!(await latestFiles()).cards.some(c => c.name === 'private-link'));
  assert.throws(() => changeInput.parse({ action: 'trash', name: '../escape', fingerprint: 'a'.repeat(64), destination: 'Trash' }));
  assert.throws(() => reminderInput.parse({ title: 'test', dueAt: '2026-11-19T15:00:00', timeZone: 'Asia/Seoul' }));
  process.env.NO_TOUCH_MODE = 'live'; await assert.rejects(latestFiles(), /LIVE_RECIPES_UNVERIFIED/); process.env.NO_TOUCH_MODE = 'fixture';
});
