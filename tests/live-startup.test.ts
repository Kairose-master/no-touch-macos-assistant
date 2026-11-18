import test from 'node:test';
import assert from 'node:assert/strict';
import { checkLiveStartup } from '../scripts/run-live.ts';
import type { NativeProfile } from '../agent/lib/native-worker.ts';

const profile: NativeProfile = {
  version: 1, enabled: true, calendarId: 'sample-calendar', reminderList: 'NoTouch Demo sample',
  dataDirectory: '/sample-only', finderWindowId: 'w-closed-finder', notesWindowId: 'w-closed-notes', notesFolder: 'NoTouch Demo API',
};

test('live startup accepts a validated profile with closed-window pins without app preparation', async () => {
  const calls: string[] = [];
  const ready = await checkLiveStartup(async () => { calls.push('profile'); return profile; }, async () => { calls.push('existing-reminders-permission'); return { fullAccess: true }; });
  assert.equal(ready, profile);
  assert.deepEqual(calls, ['profile', 'existing-reminders-permission']);
});

test('invalid profile stops startup before permission or app checks', async () => {
  const error = new Error('NATIVE_PROFILE_REQUIRED');
  await assert.rejects(checkLiveStartup(async () => { throw error; }, async () => { throw new Error('must not query after profile failure'); }), caught => caught === error);
});

test('live startup still requires existing full Reminders access and does not request it', async () => {
  for (const fullAccess of [false, undefined, 'true']) {
    let reads = 0;
    await assert.rejects(checkLiveStartup(async () => profile, async () => { reads++; return { fullAccess }; }), /REMINDERS_ACCESS_REQUIRED: run npm run permission:native/);
    assert.equal(reads, 1);
  }
});

test('permission status read errors are preserved without starting app preparation', async () => {
  const error = new Error('NATIVE_WORKER_UNAVAILABLE');
  await assert.rejects(checkLiveStartup(async () => profile, async () => { throw error; }), caught => caught === error);
});
