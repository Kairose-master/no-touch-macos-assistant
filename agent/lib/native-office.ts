import { join } from 'node:path';
import { bundles, type ReminderInput } from './contracts.ts';
import { digest } from './storage.ts';
import { callNativeWorker, nativeProfile } from './native-worker.ts';
import { nodes, snapshot } from './native-cli.ts';

export async function nativeAddReminder(scope: string, input: ReminderInput) {
  const profile = await nativeProfile();
  const saved = await callNativeWorker({ operation: 'create-reminder', calendarId: profile.calendarId,
    title: `NoTouch Demo · ${input.title}`, dueAt: input.dueAt, timeZone: input.timeZone,
    operationId: digest({ scope, kind: 'native-reminder', input }) });
  const verified = await callNativeWorker({ operation: 'read-reminder', calendarId: profile.calendarId, reminderId: saved.reminderId });
  if (!verified.verified || !verified.hasAlarm || new Date(String(verified.dueAt)).getTime() !== new Date(input.dueAt).getTime() || verified.timeZone !== input.timeZone) throw new Error('REMINDER_COMMIT_UNVERIFIED');
  return { kind: 'reminder', title: String(verified.title), dueAt: input.dueAt, timeZone: input.timeZone,
    verified: true, mode: 'live', bundleId: bundles.reminders, transport: 'EventKit', reminderId: saved.reminderId, hasAlarm: true };
}
export async function verifyFinderAbsent(name: string) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const state = await nativeFinderSnapshot();
    if (!nodes(state).some(node => node.name === name)) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('FINDER_RESULT_UNVERIFIED: inspect the moved file before any further write.');
}
export async function nativeFinderSnapshot() {
  const profile = await nativeProfile();
  await callNativeWorker({ operation: 'open-folder', folder: join(profile.dataDirectory, 'files') });
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const state = await snapshot('finder', profile.finderWindowId);
    if (state.complete && state.tree.name === 'files') return state;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('PINNED_FINDER_FOLDER_UNVERIFIED: configure a unique sample window again.');
}
