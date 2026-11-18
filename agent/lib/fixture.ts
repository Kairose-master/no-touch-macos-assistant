import { join } from 'node:path';
import { dataRoot, readJson, writeJson } from './storage.ts';
import { bundles, type App } from './contracts.ts';
import { type Envelope, type Node, type Transport, validateArgs } from './desktop.ts';

export interface FixtureState { notes: string[]; reminders: { title: string; dueAt: string }[]; noteDraft?: string; reminderDraft?: { title: string; dueAt: string } }
export class FixtureTransport implements Transport {
  private seq = 0;
  private refs = new Map<string, { app: App; name: string }>();
  async run(args: string[], text?: string): Promise<Envelope> {
    validateArgs(args, text);
    const path = join(dataRoot(), 'apps.json');
    const state = await readJson<FixtureState>(path, { notes: [], reminders: [] });
    if (args[0] === 'snapshot') {
      const app = (Object.keys(bundles) as App[]).find(app => bundles[app] === args[2])!;
      const id = `sfixture${++this.seq}`;
      this.refs.clear();
      const nodes: Node[] = [{ role: 'group', name: 'NoTouch Demo' }];
      if (app === 'notes') {
        nodes.push({ role: 'button', name: 'New Note' });
        if (state.noteDraft !== undefined) nodes.push({ role: 'text area', name: 'Note body', value: state.noteDraft });
        nodes.push(...state.notes.map(value => ({ role: 'text area', name: 'Saved note', value })));
      } else if (app === 'reminders') {
        nodes.push({ role: 'button', name: 'New Reminder' });
        if (state.reminderDraft) nodes.push({ role: 'text field', name: 'Title', value: state.reminderDraft.title }, { role: 'text field', name: 'Due', value: state.reminderDraft.dueAt }, { role: 'button', name: 'Add Reminder' });
        nodes.push(...state.reminders.map(r => ({ role: 'row', name: r.title, value: r.dueAt })));
      } else {
        const { readdir } = await import('node:fs/promises');
        nodes.push(...(await readdir(join(dataRoot(), 'files'))).filter(name => !name.startsWith('.')).map(name => ({ role: 'row', name })));
      }
      nodes.forEach((node, i) => { node.ref_id = `@${id}:e${i + 1}`; this.refs.set(node.ref_id, { app, name: node.name! }); });
      return { ok: true, data: { app: bundles[app], snapshot_id: id, complete: true, tree: { role: 'window', name: 'NoTouch Demo', children: nodes } } };
    }
    const target = this.refs.get(args[1]!);
    if (!target) return { ok: false, error: { code: 'STALE_REF', disposition: { delivery: 'not_delivered', retry: 'safe' } } };
    if (target.app === 'notes' && target.name === 'New Note' && args[0] === 'click') state.noteDraft = '';
    else if (target.app === 'notes' && target.name === 'Note body' && args[0] === 'set-value') { state.noteDraft = text!; state.notes.push(text!); }
    else if (target.app === 'reminders' && target.name === 'New Reminder' && args[0] === 'click') state.reminderDraft = { title: '', dueAt: '' };
    else if (target.app === 'reminders' && target.name === 'Title' && args[0] === 'type' && state.reminderDraft) state.reminderDraft.title += text!;
    else if (target.app === 'reminders' && target.name === 'Due' && args[0] === 'set-value' && state.reminderDraft) state.reminderDraft.dueAt = text!;
    else if (target.app === 'reminders' && target.name === 'Add Reminder' && args[0] === 'click' && state.reminderDraft) { state.reminders.push(state.reminderDraft); delete state.reminderDraft; }
    else return { ok: false, error: { code: 'ACTION_NOT_SUPPORTED', disposition: { delivery: 'not_delivered', retry: 'safe' } } };
    this.refs.clear();
    await writeJson(path, state);
    return { ok: true, data: { disposition: { delivery: 'delivered_verified', retry: 'unsafe' } } as Envelope['data'] };
  }
}
