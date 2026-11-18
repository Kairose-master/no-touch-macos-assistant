import { createHash } from 'node:crypto';
import { mkdir, open, readFile, rename } from 'node:fs/promises';
import { resolve, join } from 'node:path';

export function dataRoot() { return resolve(process.env.NO_TOUCH_DATA_DIR ?? '.demo'); }
export function digest(value: unknown) { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
export async function readJson<T>(path: string, fallback: T): Promise<T> {
  try { return JSON.parse(await readFile(path, 'utf8')) as T; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return fallback; throw error; }
}
export async function writeJson(path: string, value: unknown) {
  const temp = `${path}.${crypto.randomUUID()}.tmp`;
  const file = await open(temp, 'wx', 0o600);
  try { await file.writeFile(JSON.stringify(value, null, 2)); await file.sync(); } finally { await file.close(); }
  await rename(temp, path);
}

// Reserve before any external effect. An interrupted reservation is never replayed automatically.
// fsync + exclusive creation also rejects concurrent callers, including a fresh model call ID.
export async function once<T>(scope: string, kind: string, input: unknown, effect: () => Promise<T>): Promise<T> {
  const dir = join(dataRoot(), 'operations');
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const key = digest({ scope, kind, input });
  const path = join(dir, `${key}.json`);
  try {
    const file = await open(path, 'wx', 0o600);
    try { await file.writeFile(JSON.stringify({ status: 'started', kind, key })); await file.sync(); } finally { await file.close(); }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    const old = await readJson<{ status: string; output: T }>(path, { status: 'unknown', output: undefined as T });
    if (old.status === 'verified') return old.output;
    throw new Error('OUTCOME_UNCERTAIN: this exact operation already started. Inspect the app and reconcile locally; do not create again.');
  }
  const output = await effect();
  await writeJson(path, { status: 'verified', kind, key, output });
  return output;
}

// App state is shared across sessions. Serialize app operations across processes without stealing stale locks.
export async function withAppLock<T>(effect: () => Promise<T>): Promise<T> {
  const dir = dataRoot(); await mkdir(dir, { recursive: true, mode: 0o700 });
  const lock = join(dir, 'desktop.lock');
  try { await mkdir(lock); } catch { throw new Error('DESKTOP_BUSY: another operation or interrupted operation owns the desktop lock. Inspect before retrying.'); }
  try { return await effect(); } finally { const { rmdir } = await import('node:fs/promises'); await rmdir(lock); }
}
