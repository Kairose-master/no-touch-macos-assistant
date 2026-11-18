import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveWindow } from '../agent/lib/window-resolution.ts';
import type { CLIEnvelope, NativeSnapshot } from '../agent/lib/native-cli.ts';

const missing = () => new Error('WINDOW_NOT_FOUND');
function state(id: string, prepared = true): NativeSnapshot {
  return { app: 'Finder', snapshot_id: 'snapshot-test', complete: true, window: { id }, tree: { role: 'window', name: prepared ? 'prepared-sample' : 'another-folder' } };
}
const valid = (value: NativeSnapshot) => value.tree.name === 'prepared-sample';
const listing = (...ids: string[]): CLIEnvelope => ({ ok: true, data: ids.map(id => ({ id, accessible: true, visible: true, minimized: false, title: 'not-used-for-selection' })) });

test('window resolver reads a valid pin without listing or choosing another window', async () => {
  const pinned = state('w-pinned');
  assert.equal(await resolveWindow('w-pinned', async () => pinned, async () => { throw new Error('must not enumerate'); }, valid), pinned);
});

test('missing pin resolves exactly one validated visible window, skipping a disappeared candidate', async () => {
  const reads: string[] = [];
  const resolved = await resolveWindow('w-old', async id => {
    reads.push(id);
    if (id === 'w-old' || id === 'w-disappeared') throw missing();
    return state(id, id === 'w-sample');
  }, async () => listing('w-other', 'w-disappeared', 'w-sample'), valid);
  assert.equal(resolved.window?.id, 'w-sample');
  assert.deepEqual(reads, ['w-old', 'w-other', 'w-disappeared', 'w-sample']);
});

test('missing pin never chooses between two prepared windows', async () => {
  await assert.rejects(resolveWindow('w-old', async id => {
    if (id === 'w-old') throw missing();
    return state(id);
  }, async () => listing('w-first', 'w-second'), valid), /AMBIGUOUS_PREPARED_WINDOW: verified=2/);
});

test('missing pin reports counts when all candidates disappear or fail the sample predicate', async () => {
  await assert.rejects(resolveWindow('w-old', async id => {
    if (id !== 'w-other') throw missing();
    return state(id, false);
  }, async () => listing('w-gone', 'w-other'), valid), /PREPARED_WINDOW_NOT_FOUND: verified=0, accessibleVisible=2, disappeared=1/);
});

test('existing pin with changed scope fails rather than silently retargeting', async () => {
  let listed = false;
  await assert.rejects(resolveWindow('w-pinned', async id => state(id, false), async () => { listed = true; return listing('w-other'); }, valid), /PINNED_WINDOW_SCOPE_MISMATCH/);
  assert.equal(listed, false);
});

test('window resolver preserves permission and unknown errors without fallback', async () => {
  for (const message of ['ACCESSIBILITY_PERMISSION_DENIED', 'TIMEOUT', 'WINDOW_NOT_FOUND: uncertain extra text']) {
    const error = new Error(message);
    await assert.rejects(resolveWindow('w-old', async () => { throw error; }, async () => { throw new Error('must not enumerate'); }, valid), caught => caught === error);
  }
  await assert.rejects(resolveWindow('w-old', async () => { throw missing(); }, async () => ({ ok: false, error: { code: 'ACCESSIBILITY_PERMISSION_DENIED' } }), valid), /^Error: ACCESSIBILITY_PERMISSION_DENIED$/);
  const denied = new Error('SNAPSHOT_ACCESS_DENIED');
  await assert.rejects(resolveWindow('w-old', async id => { if (id === 'w-old') throw missing(); throw denied; }, async () => listing('w-candidate'), valid), caught => caught === denied);
});

test('an incomplete or mismatched candidate cannot hide a second possible prepared window', async () => {
  await assert.rejects(resolveWindow('w-old', async id => {
    if (id === 'w-old') throw missing();
    return id === 'w-incomplete' ? { ...state(id), complete: false } : state(id);
  }, async () => listing('w-sample', 'w-incomplete'), valid), /WINDOW_RESOLUTION_UNVERIFIED/);
  await assert.rejects(resolveWindow('w-old', async id => { if (id === 'w-old') throw missing(); return state('w-different'); }, async () => listing('w-candidate'), valid), /WINDOW_ID_MISMATCH/);
});

test('inaccessible, hidden and minimized windows are not read; malformed lists fail closed', async () => {
  const result: CLIEnvelope = { ok: true, data: [
    { id: 'w-hidden', accessible: true, visible: false },
    { id: 'w-inaccessible', accessible: false, visible: true },
    { id: 'w-minimized', accessible: true, visible: true, minimized: true },
    { id: 'w-sample', accessible: true, visible: true },
  ] };
  const reads: string[] = [];
  await resolveWindow('w-old', async id => { reads.push(id); if (id === 'w-old') throw missing(); return state(id); }, async () => result, valid);
  assert.deepEqual(reads, ['w-old', 'w-sample']);
  for (const data of [{}, [null], [{ id: 'w-item', accessible: true }], listing('w-item', 'w-item').data]) {
    await assert.rejects(resolveWindow('w-old', async () => { throw missing(); }, async () => ({ ok: true, data }), valid), /INVALID_NATIVE_WINDOW_LIST/);
  }
});
