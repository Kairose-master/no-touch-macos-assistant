import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { nativeCli, type CLIEnvelope } from './native-cli.ts';

type NotesWindow = { id: string; accessible: boolean; visible: boolean; minimized?: boolean };
export type NotesRecoveryIO = {
  launch: () => Promise<CLIEnvelope>;
  list: () => Promise<CLIEnvelope>;
  reopen: () => Promise<void>;
  wait: (ms: number) => Promise<void>;
  now: () => number;
};
const systemIO: NotesRecoveryIO = {
  launch: () => nativeCli(['launch', 'com.apple.Notes']),
  list: () => nativeCli(['list-windows', '--app', 'com.apple.Notes']),
  async reopen() {
    // Fixed executable and arguments: no model input, shell or activation flag.
    // macOS open(1): -g does not bring the app to the foreground. Unlike the
    // desktop CLI's running-process attachment, this sends a reopen request.
    try { await promisify(execFile)('/usr/bin/open', ['-g', '-b', 'com.apple.Notes'], { shell: false, timeout: 10000 }); }
    catch { throw new Error('NOTES_BACKGROUND_REOPEN_FAILED'); }
  },
  wait: ms => new Promise(resolve => setTimeout(resolve, ms)),
  now: Date.now,
};
function visibleWindows(result: CLIEnvelope): NotesWindow[] {
  if (!result.ok) throw new Error(result.error?.code ?? 'NOTES_WINDOW_LIST_FAILED');
  if (!Array.isArray(result.data)) throw new Error('INVALID_NATIVE_WINDOW_LIST');
  const seen = new Set<string>();
  for (const window of result.data) {
    if (!window || typeof window.id !== 'string' || !/^w-[\w-]+$/.test(window.id)
      || typeof window.accessible !== 'boolean' || typeof window.visible !== 'boolean'
      || (window.minimized !== undefined && typeof window.minimized !== 'boolean') || seen.has(window.id)) {
      throw new Error('INVALID_NATIVE_WINDOW_LIST');
    }
    seen.add(window.id);
  }
  const eligible = result.data.filter(window => window.accessible && window.visible && !window.minimized);
  if (eligible.length > 10) throw new Error('TOO_MANY_NOTES_WINDOWS');
  return eligible;
}
async function waitForWindows(io: NotesRecoveryIO, duration: number) {
  const deadline = io.now() + duration;
  let windows = visibleWindows(await io.list());
  while (windows.length === 0 && io.now() < deadline) {
    await io.wait(100);
    windows = visibleWindows(await io.list());
  }
  return windows;
}
/** Preparation only. A window candidate still needs exact sample-folder proof. */
export async function recoverNotesWindows(io: NotesRecoveryIO = systemIO) {
  const launch = await io.launch();
  if (!launch.ok) throw new Error(launch.error?.code ?? 'NOTES_BACKGROUND_LAUNCH_FAILED');
  const existing = await waitForWindows(io, 1500);
  if (existing.length > 0) return existing;
  await io.reopen(); // At most one reopen; never create a note to obtain a window.
  return waitForWindows(io, 10000);
}
