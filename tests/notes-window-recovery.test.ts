import test from 'node:test';
import assert from 'node:assert/strict';
import { recoverNotesWindows, type NotesRecoveryIO } from '../agent/lib/notes-window-recovery.ts';
import type { CLIEnvelope } from '../agent/lib/native-cli.ts';

const window = { id: 'w-sample', accessible: true, visible: true, minimized: false };
const ok = (data: unknown): CLIEnvelope => ({ ok: true, data });
function harness(read: (reopened: boolean, elapsed: number) => CLIEnvelope) {
  let elapsed = 0, reopens = 0, launches = 0;
  const io: NotesRecoveryIO = {
    launch: async () => { launches++; return ok({}); },
    list: async () => read(reopens > 0, elapsed),
    reopen: async () => { reopens++; },
    wait: async ms => { elapsed += ms; },
    now: () => elapsed,
  };
  return { io, counts: () => ({ elapsed, reopens, launches }) };
}
test('a running process with no windows is reopened once and waits for a visible window', async () => {
  const h = harness((reopened, elapsed) => ok(!reopened ? [] : [{ ...window, visible: elapsed >= 1900 }]));
  assert.deepEqual(await recoverNotesWindows(h.io), [window]);
  assert.deepEqual(h.counts(), { elapsed: 1900, reopens: 1, launches: 1 });
});
test('existing visible candidates are returned intact without a reopen or arbitrary selection', async () => {
  const candidates = [window, { ...window, id: 'w-second' }];
  const h = harness(() => ok(candidates));
  assert.deepEqual(await recoverNotesWindows(h.io), candidates);
  assert.equal(h.counts().reopens, 0);
});
test('a slow initial window is observed before considering a reopen', async () => {
  const h = harness((_reopened, elapsed) => ok(elapsed < 400 ? [] : [window]));
  assert.deepEqual(await recoverNotesWindows(h.io), [window]);
  assert.equal(h.counts().reopens, 0);
});
test('permission or invalid window-list errors do not trigger a reopen', async () => {
  for (const result of [{ ok: false, error: { code: 'PERM_DENIED' } }, ok(null), ok([window, window]), ok([{ ...window, visible: undefined }])]) {
    const h = harness(() => result as CLIEnvelope);
    await assert.rejects(recoverNotesWindows(h.io), /PERM_DENIED|INVALID_NATIVE_WINDOW_LIST/);
    assert.equal(h.counts().reopens, 0);
  }
});
test('failure to obtain a visible window remains bounded without repeatedly reopening', async () => {
  const h = harness(() => ok([{ ...window, minimized: true }]));
  assert.deepEqual(await recoverNotesWindows(h.io), []);
  assert.deepEqual(h.counts(), { elapsed: 11500, reopens: 1, launches: 1 });
});
test('a failed launch is not retried or replaced with a reopen', async () => {
  const h = harness(() => { throw new Error('list must not run'); });
  h.io.launch = async () => ({ ok: false, error: { code: 'APP_UNRESPONSIVE', disposition: { retry: 'unsafe', delivery: 'unknown' } } });
  await assert.rejects(recoverNotesWindows(h.io), /APP_UNRESPONSIVE/);
  assert.equal(h.counts().reopens, 0);
});
test('a reopen failure is propagated without another dispatch', async () => {
  const h = harness(() => ok([])); let attempts = 0;
  h.io.reopen = async () => { attempts++; throw new Error('NOTES_BACKGROUND_REOPEN_FAILED'); };
  await assert.rejects(recoverNotesWindows(h.io), /NOTES_BACKGROUND_REOPEN_FAILED/);
  assert.equal(attempts, 1);
});
