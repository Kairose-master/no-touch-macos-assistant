import { lstat, mkdir, readFile, readdir, realpath, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { bundles, type ChangeInput, type NoteInput, type ReminderInput } from './contracts.ts';
import { Desktop, flatten, unique, type Selector, type Snapshot } from './desktop.ts';
import { FixtureTransport } from './fixture.ts';
import { dataRoot, digest, once, withAppLock } from './storage.ts';

const tracer = trace.getTracer('no-touch-office', '1.0.0');
async function measured<T>(kind: string, effect: () => Promise<T>) {
  return tracer.startActiveSpan(`office.${kind}`, async span => {
    span.setAttribute('office.mode', process.env.NO_TOUCH_MODE ?? 'fixture');
    try { return await effect(); } catch (error) { span.setStatus({ code: SpanStatusCode.ERROR, message: 'Office operation blocked or unverified' }); throw error; } finally { span.end(); }
  });
}
const windows = { notes: 'w-fixture-notes', reminders: 'w-fixture-reminders', finder: 'w-fixture-finder' };
const s = {
  noteNew: { role: 'button', name: 'New Note' }, noteBody: { role: 'text area', name: 'Note body' },
  reminderNew: { role: 'button', name: 'New Reminder' }, reminderTitle: { role: 'text field', name: 'Title' },
  reminderDue: { role: 'text field', name: 'Due' }, reminderSave: { role: 'button', name: 'Add Reminder' },
};
function desktop() {
  // Fixture selectors are never reused as native selectors. Live dispatch occurs in the capabilities below.
  if ((process.env.NO_TOUCH_MODE ?? 'fixture') !== 'fixture') throw new Error('UNSUPPORTED_MODE: choose fixture or explicitly configured live mode.');
  return new Desktop(new FixtureTransport(), windows);
}
const fieldEquals = (selector: Selector, value: string) => (snapshot: Snapshot) => unique(snapshot, selector).value === value;
const inDemo = (snapshot: Snapshot) => snapshot.tree.name === 'NoTouch Demo';
const live = () => process.env.NO_TOUCH_MODE === 'live';
const operationKind = (kind: string) => `${live() ? 'live' : 'fixture'}:${kind}`;

export async function writeNote(scope: string, input: NoteInput) {
  return measured('write_note', () => withAppLock(async () => {
    let prepared;
    if(live()){try{prepared=await(await import('./native-ready.ts')).prepareNativeNotes();}catch(error){throw new Error('NOTES_PREPARATION_FAILED: '+(error instanceof Error?error.message:'UNKNOWN'));}}
    return once(scope, operationKind('write_note'), input, async () => {
    if (live()) { const { nativeWriteNote } = await import('./native-notes.ts'); return nativeWriteNote(input, prepared!); }
    const d = desktop(); const content = `${input.title}\n${input.body}`;
    await d.act('notes', s.noteNew, 'click', fieldEquals(s.noteBody, ''), undefined, inDemo);
    await d.act('notes', s.noteBody, 'set-value', fieldEquals(s.noteBody, content), content, fieldEquals(s.noteBody, ''));
    return { kind: 'note', title: input.title, verified: true, mode: 'fixture', bundleId: bundles.notes };
    });
  }));
}
export async function addReminder(scope: string, input: ReminderInput) {
  new Intl.DateTimeFormat('en', { timeZone: input.timeZone }).format();
  return measured('add_reminder', () => withAppLock(() => once(scope, operationKind('add_reminder'), input, async () => {
    if (live()) { const { nativeAddReminder } = await import('./native-office.ts'); return nativeAddReminder(scope, input); }
    const d = desktop();
    await d.act('reminders', s.reminderNew, 'click', fieldEquals(s.reminderTitle, ''), undefined, inDemo);
    await d.act('reminders', s.reminderTitle, 'type', fieldEquals(s.reminderTitle, input.title), input.title, fieldEquals(s.reminderTitle, ''));
    await d.act('reminders', s.reminderDue, 'set-value', fieldEquals(s.reminderDue, input.dueAt), input.dueAt, fieldEquals(s.reminderTitle, input.title));
    await d.act('reminders', s.reminderSave, 'click', snap => flatten(snap.tree).some(node => node.role === 'row' && node.name === input.title && node.value === input.dueAt), undefined,
      snap => fieldEquals(s.reminderTitle, input.title)(snap) && fieldEquals(s.reminderDue, input.dueAt)(snap));
    return { kind: 'reminder', title: input.title, dueAt: input.dueAt, timeZone: input.timeZone, verified: true, mode: 'fixture', bundleId: bundles.reminders };
  })));
}
async function filesRoot() {
  const root = join(dataRoot(), 'files');
  if (await readFile(join(dataRoot(), '.no-touch-fixture'), 'utf8') !== 'no-touch-fixture-v1') throw new Error('FIXTURE_MARKER_REQUIRED');
  if (await realpath(root) !== root || !(await lstat(root)).isDirectory()) throw new Error('UNSAFE_DEMO_ROOT');
  return root;
}
async function fileCard(name: string) {
  if (!name || name.includes('/') || name.includes('\\') || name.startsWith('.') || name.includes('\0')) throw new Error('INVALID_FILE_NAME');
  const path = join(await filesRoot(), name); const stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 1_000_000) throw new Error('FILE_OUT_OF_SCOPE');
  const bytes = await readFile(path);
  return { name, size: stat.size, modifiedAt: stat.mtime.toISOString(), fingerprint: digest({ name, bytes: bytes.toString('base64'), mtime: stat.mtimeMs, ino: stat.ino }), path };
}
export async function latestFiles() {
  return measured('latest_files', () => withAppLock(async () => {
    const snapshot = live() ? await (await import('./native-office.ts')).nativeFinderSnapshot() : await desktop().snapshot('finder');
    if (!live() && !inDemo(snapshot)) throw new Error('DEMO_WINDOW_REQUIRED');
    const root = await filesRoot(); const cards = [];
    for (const file of await readdir(root, { withFileTypes: true })) {
      if (!file.isFile() || file.name.startsWith('.')) continue;
      const card = await fileCard(file.name);
      if (flatten(snapshot.tree).some(node => node.name === card.name)) cards.push(card);
    }
    cards.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt) || a.name.localeCompare(b.name));
    return { kind: 'files', mode: live() ? 'live' : 'fixture', bundleId: bundles.finder, cards: cards.slice(0, 5) };
  }));
}
export async function changeFile(scope: string, input: ChangeInput) {
  if (live()) await (await import('./native-worker.ts')).nativeProfile(); else desktop();
  return measured(`file_${input.action}`, () => withAppLock(async () => {
    if(live()){try{await(await import('./native-office.ts')).nativeFinderSnapshot();}catch(error){throw new Error('FINDER_PREPARATION_FAILED: '+(error instanceof Error?error.message:'UNKNOWN'));}}
    return once(scope, operationKind('change_file'), input, async () => {
    const card = await fileCard(input.name);
    if (card.fingerprint !== input.fingerprint) throw new Error('FILE_CHANGED: request a fresh card and a new approval.');
    const dir = join(await filesRoot(), input.action === 'share' ? '.share-preview' : input.destination);
    await mkdir(dir, { recursive: true, mode: 0o700 });
    if (await realpath(dir) !== dir) throw new Error('UNSAFE_DESTINATION');
    const destination = join(dir, input.action === 'share' ? `${input.name}.json` : input.name);
    await writeFile(`${destination}.claim`, '', { flag: 'wx', mode: 0o600 });
    try { await lstat(destination); throw new Error('DESTINATION_EXISTS'); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    if (input.action === 'share') await writeFile(destination, JSON.stringify({ previewOnly: true, externalDelivery: false, name: card.name, fingerprint: card.fingerprint }), { flag: 'wx', mode: 0o600 });
    else await rename(card.path, destination);
    if (!(await lstat(destination)).isFile()) throw new Error('UNVERIFIED_RESULT');
    if (input.action !== 'share') { try { await lstat(card.path); throw new Error('SOURCE_STILL_PRESENT'); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; } }
    if (live() && input.action !== 'share') await (await import('./native-office.ts')).verifyFinderAbsent(input.name);
    return { kind: 'file-change', action: input.action, name: input.name, destination: input.destination, verified: true, mode: live() ? 'live' : 'fixture', transport: 'scoped-filesystem', externalDelivery: false };
    });
  }));
}
