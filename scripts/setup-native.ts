import { mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { callNativeWorker, type NativeProfile } from '../agent/lib/native-worker.ts';
import { nativeCli } from '../agent/lib/native-cli.ts';
import { readJson, writeJson } from '../agent/lib/storage.ts';
import { seed } from './seed.ts';
await mkdir('.demo-native', { recursive: true, mode: 0o700 });
const status = await callNativeWorker({ operation: 'status' });
if (!status.fullAccess) throw new Error('REMINDERS_ACCESS_REQUIRED: request permission as a separate explicit operator action.');
const path = resolve('.demo-native/profile.json');
const old = await readJson<NativeProfile | null>(path, null);
const notesFolder = 'NoTouch Demo API';
async function windowId(app: string, title: string) {
  const result = await nativeCli(['list-windows', '--app', app]);
  const candidates = result.ok && Array.isArray(result.data) ? result.data.filter((item: { accessible: boolean; visible: boolean; title: string }) => item.accessible && item.visible && item.title === title) : [];
  if (candidates.length !== 1) throw new Error(`PREPARE_UNIQUE_SAMPLE_WINDOW: ${app} / ${title}. No arbitrary candidate was selected.`);
  return candidates[0].id as string;
}
// Prepare/select this dedicated folder manually before a presentation. Never open a floating note.
const notesWindowId = await windowId('com.apple.Notes', notesFolder);
const dataDirectory = old?.dataDirectory ?? resolve('.demo-native/data');
await seed(dataDirectory);
await callNativeWorker({ operation: 'open-folder', folder: join(dataDirectory, 'files') });
const finderWindowId = await windowId('com.apple.finder', 'files');
const calendar = old ? { calendarId: old.calendarId, title: old.reminderList } : await callNativeWorker({ operation: 'prepare-reminders', title: 'NoTouch Demo API 20261118' });
await writeJson(path, { version: 1, enabled: true, calendarId: calendar.calendarId, reminderList: calendar.title, dataDirectory, notesFolder, notesWindowId, finderWindowId });
console.log('Native profile prepared/refreshed. Existing sample data and reminder list were retained.');
