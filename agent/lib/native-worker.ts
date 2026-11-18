import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { readJson } from './storage.ts';
export interface NativeProfile { version: 1; enabled: boolean; calendarId: string; reminderList: string; dataDirectory: string; finderWindowId: string; notesWindowId: string; notesFolder: string }
export async function nativeProfile() {
  if (process.platform !== 'darwin' || process.env.NO_TOUCH_MODE !== 'live' || process.env.NO_TOUCH_LIVE !== 'I_AUTHORIZE_ISOLATED_APP_CONTROL') throw new Error('LIVE_DISABLED');
  const profile = await readJson<NativeProfile | null>(resolve('.demo-native/profile.json'), null);
  if (!profile || profile.version !== 1 || !profile.enabled || !profile.reminderList.startsWith('NoTouch Demo') || !profile.calendarId || !/^w-[\w-]+$/.test(profile.finderWindowId ?? '') || !/^w-[\w-]+$/.test(profile.notesWindowId ?? '') || profile.notesFolder !== 'NoTouch Demo API') throw new Error('NATIVE_PROFILE_REQUIRED');
  if (resolve(process.env.NO_TOUCH_DATA_DIR ?? '.demo') !== resolve(profile.dataDirectory)) throw new Error('NATIVE_DATA_DIRECTORY_MISMATCH');
  return profile;
}
export async function callNativeWorker<T extends Record<string, unknown> = Record<string, unknown>>(request: Record<string, unknown>): Promise<T> {
  const operations = ['status', 'desktop-state', 'request-reminders', 'prepare-reminders', 'create-reminder', 'read-reminder', 'open-folder'];
  if (!operations.includes(String(request.operation))) throw new Error('NATIVE_OPERATION_NOT_ALLOWED');
  return new Promise((accept, reject) => {
    const child = spawn(resolve('.native-build/NoTouch Local Worker.app/Contents/MacOS/NoTouchWorker'), [], { shell: false, stdio: ['pipe', 'pipe', 'pipe'], timeout: request.operation === 'request-reminders' ? 180000 : 20000 });
    let output = ''; let bytes = 0;
    child.stdout.on('data', (data: Buffer) => { bytes += data.length; if (bytes > 1_000_000) child.kill(); else output += data.toString(); });
    child.stderr.resume(); child.stdin.on('error', () => {});
    child.on('error', () => reject(new Error('NATIVE_WORKER_UNAVAILABLE: run npm run build:native first.')));
    child.on('close', () => {
      try { const result = JSON.parse(output); if (!result.ok) reject(new Error(String(result.error?.code ?? 'NATIVE_OUTCOME_UNCERTAIN'))); else accept(result.data as T); }
      catch { reject(new Error('NATIVE_OUTCOME_UNCERTAIN: observe before repeating.')); }
    });
    child.stdin.end(JSON.stringify(request));
  });
}
