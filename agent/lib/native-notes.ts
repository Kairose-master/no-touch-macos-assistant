import { bundles, type NoteInput } from './contracts.ts';
import { nativeCli, nodes, one, scoped, snapshot, value, type NativeSnapshot } from './native-cli.ts';
import { nativeProfile } from './native-worker.ts';
import { assertNotesBackground } from './native-ready.ts';

function assertSampleFolder(state: NativeSnapshot, folder: string) {
  if (!state.complete || state.tree.name !== folder || !nodes(state).some(node => node.role === 'cell' && node.states?.includes('selected') && node.name?.startsWith(folder + ','))) throw new Error('OWN_NOTES_FOLDER_NOT_SELECTED');
}
function sampleNoteCount(state: NativeSnapshot, folder: string) {
  const selected = one(nodes(state).filter(node => node.role === 'cell' && node.states?.includes('selected') && node.name?.startsWith(folder + ',')));
  const count = selected.name?.match(/, ([0-9,]+)개의 메모$/)?.[1];
  if (selected.name === `${folder}, 메모 없음`) return 0;
  if (!count) throw new Error('NOTES_COUNT_UNVERIFIED');
  return Number(count.replaceAll(',', ''));
}
export async function nativeWriteNote(input: NoteInput, prepared: NativeSnapshot) {
  const profile = await nativeProfile();
  const windowId = prepared.window!.id;
  let created = false;
  for (let attempt = 0; attempt < 2; attempt++) {
    const before = await snapshot('notes', windowId);
    assertSampleFolder(before, profile.notesFolder);
    const priorCount = sampleNoteCount(before, profile.notesFolder);
    const toolbar = nodes(before).filter(node => node.role === 'toolbar');
    if (toolbar.length !== 1) throw new Error('AMBIGUOUS_NOTES_TOOLBAR');
    const temporary: NativeSnapshot = { ...before, tree: toolbar[0] };
    const target = one(nodes(temporary).filter(node => node.role === 'button' && node.name === '새로운 메모' && !node.states?.includes('disabled')));
    const scope = await scoped(target);
    await assertNotesBackground();
    const result = await nativeCli(['click', scope.tree.ref_id!]);
    const after = await snapshot('notes', windowId);
    assertSampleFolder(after, profile.notesFolder);
    const fields = nodes(after).filter(node => node.native_id?.value === 'Note Body Text View');
    if (sampleNoteCount(after, profile.notesFolder) === priorCount + 1 && fields.length === 1 && await value(fields[0]) === '') { created = true; break; }
    if (attempt === 0 && ['STALE_REF', 'AMBIGUOUS_TARGET'].includes(result.error?.code ?? '') && result.error?.disposition?.retry === 'safe' && result.error.disposition.delivery === 'not_delivered') continue;
    throw new Error('NOTES_CREATION_OUTCOME_UNCERTAIN: inspect before creating another note.');
  }
  if (!created) throw new Error('NEW_NOTE_NOT_VERIFIED');
  const fresh = await snapshot('notes', windowId);
  assertSampleFolder(fresh, profile.notesFolder);
  const body = one(nodes(fresh).filter(node => node.native_id?.value === 'Note Body Text View'));
  if (await value(body) !== '') throw new Error('EXISTING_NOTE_CONTENT: refusing to edit.');
  const title = `NoTouch Demo · ${input.title}`;
  const text = `${title}\n${input.body}`;
  await assertNotesBackground();
  await nativeCli(['set-value', body.ref_id!, '--stdin'], text);
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const after = await snapshot('notes', windowId);
    assertSampleFolder(after, profile.notesFolder);
    const field = one(nodes(after).filter(node => node.native_id?.value === 'Note Body Text View'));
    if (await value(field) === text) return { kind: 'note', title, verified: true, mode: 'live', bundleId: bundles.notes, transport: 'agent-desktop/headless', verification: 'ui-content-readback', windowId };
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('NOTES_CONTENT_OUTCOME_UNCERTAIN');
}
