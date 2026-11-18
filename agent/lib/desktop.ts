import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { bundles, type App } from './contracts.ts';

export interface Node { role: string; name?: string; value?: string; ref_id?: string; children?: Node[] }
export interface Snapshot { app: string; snapshot_id: string; complete: boolean; tree: Node }
export interface Disposition { delivery: string; retry: string }
export interface Envelope { ok: boolean; data?: Snapshot & { disposition?: Disposition }; error?: { code: string; disposition?: Disposition; details?: unknown } }
export interface Transport { run(args: string[], text?: string): Promise<Envelope> }
export interface Selector { role: string; name: string }
export class DesktopError extends Error {
  result: Envelope;
  constructor(result: Envelope) { super(result.error?.code ?? 'UNVERIFIED_ACTION'); this.result = result; }
}
export function flatten(node: Node): Node[] { return [node, ...(node.children ?? []).flatMap(flatten)]; }
export function unique(snapshot: Snapshot, selector: Selector) {
  if (!snapshot.complete) throw new Error('INCOMPLETE_SNAPSHOT: no action is permitted.');
  const matches = flatten(snapshot.tree).filter(node => node.role === selector.role && node.name === selector.name);
  if (matches.length !== 1) throw new Error(`AMBIGUOUS_TARGET: expected one ${selector.role}; observed ${matches.length}. Ask for a pinned window or a unique target.`);
  const node = matches[0]!;
  if (!node.ref_id?.startsWith(`@${snapshot.snapshot_id}:`) || !/^@[^:]+:e\d+$/.test(node.ref_id)) throw new Error('INVALID_REF');
  return node;
}

// No arbitrary args, shell, physical keys, focus, clipboard, coordinates, launch or headed fallback.
export function validateArgs(args: string[], text?: string) {
  if (args[0] === 'snapshot') {
    if (args.length !== 8 || args[1] !== '--app' || !Object.values(bundles).includes(args[2] as never) || args[3] !== '-i' || args[4] !== '--window-id' || !/^w-[\w-]+$/.test(args[5] ?? '') || args[6] !== '--timeout-ms' || args[7] !== '5000') throw new Error('POLICY_DENIED');
  } else if (['click', 'type', 'set-value'].includes(args[0] ?? '')) {
    if (!/^@[^:]+:e\d+$/.test(args[1] ?? '')) throw new Error('INVALID_REF');
    if (args[0] === 'click' ? args.length !== 2 : args.length !== 3 || args[2] !== '--stdin' || text === undefined || Buffer.byteLength(text) > 9000) throw new Error('POLICY_DENIED');
  } else throw new Error('POLICY_DENIED');
}
export class CliTransport implements Transport {
  async run(args: string[], text?: string): Promise<Envelope> {
    validateArgs(args, text);
    if (process.env.NO_TOUCH_MODE !== 'live' || process.env.NO_TOUCH_LIVE !== 'I_AUTHORIZE_ISOLATED_APP_CONTROL') throw new Error('LIVE_DISABLED');
    return new Promise((accept, reject) => {
      const child = spawn(resolve('node_modules/.bin/agent-desktop'), args, { shell: false, stdio: ['pipe', 'pipe', 'pipe'], timeout: 15000 });
      let out = ''; let size = 0;
      child.stdout.on('data', (chunk: Buffer) => { size += chunk.length; if (size > 2_000_000) child.kill(); else out += chunk.toString(); });
      child.stderr.resume();
      child.on('error', () => reject(new Error('CLI_OUTCOME_UNCERTAIN: observe before repeating.')));
      child.on('close', () => { try { accept(JSON.parse(out)); } catch { reject(new Error('CLI_OUTCOME_UNCERTAIN: invalid or incomplete envelope.')); } });
      child.stdin.end(text);
    });
  }
}
export class Desktop {
  private transport: Transport;
  private windows: Record<App, string>;
  constructor(transport: Transport, windows: Record<App, string>) { this.transport = transport; this.windows = windows; }
  async snapshot(app: App) {
    const result = await this.transport.run(['snapshot', '--app', bundles[app], '-i', '--window-id', this.windows[app], '--timeout-ms', '5000']);
    const displayNames = { notes: 'Notes', reminders: 'Reminders', finder: 'Finder' };
    if (!result.ok || !result.data || !result.data.complete || ![bundles[app], displayNames[app]].includes(result.data.app)) throw new DesktopError(result);
    return result.data;
  }
  async act(app: App, selector: Selector, command: 'click' | 'type' | 'set-value', verify: (s: Snapshot) => boolean, text?: string, before?: (s: Snapshot) => boolean) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const snapshot = await this.snapshot(app);
      if (before && !before(snapshot)) throw new Error('PRECONDITION_FAILED: refusing to edit existing content.');
      const node = unique(snapshot, selector);
      const result = await this.transport.run(command === 'click' ? [command, node.ref_id!] : [command, node.ref_id!, '--stdin'], text);
      // Always observe, even after uncertain delivery. No action substitution until delivery is known safe.
      const observed = await this.snapshot(app);
      // A missing expected field is not a verified outcome, and is common after a safe stale-ref error.
      let verified = false;
      try { verified = verify(observed); } catch { /* no confirmed effect */ }
      if (verified) return observed;
      const disposition = result.ok ? result.data?.disposition : result.error?.disposition;
      const recoverable = !result.ok && ['STALE_REF', 'AMBIGUOUS_TARGET', 'SNAPSHOT_NOT_FOUND'].includes(result.error?.code ?? '');
      if (attempt === 0 && recoverable && disposition?.retry === 'safe' && disposition.delivery === 'not_delivered') continue;
      throw new DesktopError(result);
    }
    throw new Error('UNVERIFIED_ACTION');
  }
}
