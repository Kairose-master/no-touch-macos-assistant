import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson } from '../agent/lib/storage.ts';
import { callNativeWorker, nativeProfile, type NativeProfile } from '../agent/lib/native-worker.ts';

// These startup checks only read the saved scope and existing permission.
// App/window preparation belongs to the approved job, not server startup.
export async function checkLiveStartup(
  checkProfile: () => Promise<NativeProfile> = nativeProfile,
  readReminderStatus: () => Promise<{ fullAccess: unknown }> = () => callNativeWorker<{ fullAccess: unknown }>({ operation: 'status' }),
) {
  const profile = await checkProfile();
  if ((await readReminderStatus()).fullAccess !== true) throw new Error('REMINDERS_ACCESS_REQUIRED: run npm run permission:native in this same terminal, then npm run setup:native.');
  return profile;
}

async function runLive() {
  const profile = await readJson<NativeProfile | null>('.demo-native/profile.json', null);
  if (!profile) throw new Error('Run setup:native first; no permission or setup is performed by live.');
  process.env.NO_TOUCH_MODE = 'live';
  process.env.NO_TOUCH_LIVE = 'I_AUTHORIZE_ISOLATED_APP_CONTROL';
  process.env.NO_TOUCH_DATA_DIR = profile.dataDirectory;
  process.env.NO_TOUCH_DEMO_DUE_AT ??= '2030-11-19T15:00:00+09:00';
  process.env.NO_TOUCH_MODEL ??= 'chatgpt';
  await checkLiveStartup();
  console.log('NoTouch: 저장된 프로필과 기존 미리 알림 권한을 확인했습니다. Notes 준비는 승인된 작업을 실행할 때 확인합니다. 서버 시작은 앱 준비 완료를 뜻하지 않습니다.');
  const child = spawn(process.execPath, ['scripts/run-demo.mjs', '--live'], { env: process.env, stdio: 'inherit' });
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => child.kill(signal));
  child.on('exit', code => { process.exitCode = code ?? 1; });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runLive();
