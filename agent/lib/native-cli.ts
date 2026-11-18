import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { bundles, type App } from './contracts.ts';
import { flatten, type Node, type Snapshot } from './desktop.ts';
export interface NativeNode extends Node { native_id?: { kind: string; value: string }; states?: string[]; available_actions?: string[] }
export interface NativeSnapshot extends Snapshot { window?: { id: string; title?: string }; tree: NativeNode }
export interface CLIEnvelope { ok: boolean; data?: any; error?: { code: string; disposition?: { delivery: string; retry: string } } }
const ref = /^@[^:]+:e\d+$/;
export function validateNativeArgs(args: string[], input?: string) {
  if(args[0]==='permissions'){if(args.length!==1)throw new Error('NATIVE_ARGS_DENIED');return;}
  if (['click', 'type', 'set-value'].includes(args[0])) {
    if (!ref.test(args[1] ?? '') || (args[0] === 'click' ? args.length !== 2 : args.length !== 3 || args[2] !== '--stdin' || input === undefined || Buffer.byteLength(input) > 128000)) throw new Error('NATIVE_ARGS_DENIED');
    return;
  }
  if (args[0] === 'get') { if (args.length !== 4 || !ref.test(args[1]) || args[2] !== '--property' || !['value', 'bounds'].includes(args[3])) throw new Error('NATIVE_ARGS_DENIED'); return; }
  if (['launch', 'list-windows'].includes(args[0])) {
    const app = args[0] === 'launch' ? args[1] : args[2];
    if (!(Object.values(bundles) as string[]).includes(app) || (args[0] === 'launch' ? args.length !== 2 : args.length !== 3 || args[1] !== '--app')) throw new Error('NATIVE_ARGS_DENIED'); return;
  }
  if (args[0] !== 'snapshot') throw new Error('NATIVE_ARGS_DENIED');
  const keys = args.filter(value => value.startsWith('--') || value === '-i');
  if (new Set(keys).size !== keys.length || !keys.includes('-i') || keys.includes('--root') === keys.includes('--app') || (keys.includes('--window-id') && !keys.includes('--app'))) throw new Error('NATIVE_ARGS_DENIED');
  for (let i = 1; i < args.length; i++) {
    const key = args[i]; if (key === '-i') continue;
    const value = args[++i];
    if (key === '--app' && (Object.values(bundles) as string[]).includes(value)) continue;
    if (key === '--window-id' && /^w-[\w-]+$/.test(value ?? '')) continue;
    if (key === '--root' && ref.test(value ?? '')) continue;
    if (key === '--surface' && ['window', 'menubar', 'sheet'].includes(value)) continue;
    if (key === '--timeout-ms' && value === '10000') continue;
    if (key === '--max-depth' && value === '20') continue;
    throw new Error('NATIVE_ARGS_DENIED');
  }
}
export async function nativeCli(args: string[], input?: string): Promise<CLIEnvelope> {
  validateNativeArgs(args, input);
  return new Promise((accept, reject) => {
    const child = spawn(resolve('node_modules/.bin/agent-desktop'), args, { shell: false, stdio: ['pipe', 'pipe', 'pipe'], timeout: 18000 });
    let output = ''; let bytes = 0;
    child.stdout.on('data', (data: Buffer) => { bytes += data.length; if (bytes > 3_000_000) child.kill(); else output += data.toString(); });
    child.stderr.resume(); child.stdin.on('error', () => {});
    child.on('error', () => reject(new Error('CLI_OUTCOME_UNCERTAIN')));
    child.on('close', () => { try { accept(JSON.parse(output)); } catch { reject(new Error('CLI_OUTCOME_UNCERTAIN')); } });
    child.stdin.end(input);
  });
}
export function nodes(snapshot: NativeSnapshot) { return flatten(snapshot.tree) as NativeNode[]; }
export function one(items: NativeNode[]) { if (items.length !== 1 || !items[0].ref_id) throw new Error('AMBIGUOUS_NATIVE_TARGET'); return items[0]; }
export async function snapshot(app: App, windowId?: string, surface = 'window'): Promise<NativeSnapshot> {
  const result = await nativeCli(['snapshot', '--app', bundles[app], ...(windowId ? ['--window-id', windowId] : []), '--surface', surface, '-i', '--max-depth', '20', '--timeout-ms', '10000']);
  if (!result.ok) throw new Error(result.error?.code ?? 'NATIVE_SNAPSHOT_FAILED');
  const aliases = { notes: [bundles.notes, 'Notes', '메모'], reminders: [bundles.reminders, 'Reminders', '미리 알림'], finder: [bundles.finder, 'Finder'] };
  if (!aliases[app].includes(result.data?.app)) throw new Error('NATIVE_APP_MISMATCH');
  return result.data;
}
export async function scoped(node: NativeNode): Promise<NativeSnapshot> {
  const result = await nativeCli(['snapshot', '--root', node.ref_id!, '-i', '--max-depth', '20', '--timeout-ms', '10000']);
  if (!result.ok || !result.data.complete) throw new Error('INCOMPLETE_NATIVE_TARGET');
  return result.data;
}
export async function value(node: NativeNode) {
  const result = await nativeCli(['get', node.ref_id!, '--property', 'value']);
  if (!result.ok) throw new Error(result.error?.code ?? 'NATIVE_READ_FAILED');
  return result.data.value;
}
