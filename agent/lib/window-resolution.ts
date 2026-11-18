import type { CLIEnvelope, NativeSnapshot } from './native-cli.ts';

const windowId = /^w-[\w-]+$/;

function missingWindow(error: unknown) {
  // Only this exact read failure permits discovery. Permission, timeout and
  // malformed-response errors must not silently select another window.
  return error instanceof Error && error.message === 'WINDOW_NOT_FOUND';
}

function confidentSnapshot(state: NativeSnapshot, id: string) {
  if (state.window?.id !== id) throw new Error('WINDOW_ID_MISMATCH: window discovery stopped.');
  if (!state.complete) throw new Error('WINDOW_RESOLUTION_UNVERIFIED: an incomplete snapshot cannot prove a unique prepared window.');
}

/** Read-only discovery; callers must never use it to repeat an issued write. */
export async function resolveWindow(
  pinnedId: string,
  load: (id: string) => Promise<NativeSnapshot>,
  list: () => Promise<CLIEnvelope>,
  valid: (snapshot: NativeSnapshot) => boolean,
): Promise<NativeSnapshot> {
  if (!windowId.test(pinnedId)) throw new Error('INVALID_PINNED_WINDOW_ID');
  let pinned: NativeSnapshot;
  try { pinned = await load(pinnedId); }
  catch (error) {
    if (!missingWindow(error)) throw error;
    return discoverWindow(load, list, valid);
  }
  confidentSnapshot(pinned, pinnedId);
  if (!valid(pinned)) throw new Error('PINNED_WINDOW_SCOPE_MISMATCH: restore the prepared folder in the pinned window; no replacement was selected.');
  return pinned;
}

export async function discoverWindow(
  load: (id: string) => Promise<NativeSnapshot>,
  list: () => Promise<CLIEnvelope>,
  valid: (snapshot: NativeSnapshot) => boolean,
) {
  const result = await list();
  if (!result.ok) throw new Error(result.error?.code ?? 'WINDOW_RESOLUTION_LIST_FAILED');
  if (!Array.isArray(result.data)) throw new Error('INVALID_NATIVE_WINDOW_LIST');
  const candidates: string[] = [];
  const listed = new Set<string>();
  for (const item of result.data) {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !windowId.test(item.id)
      || typeof item.accessible !== 'boolean' || typeof item.visible !== 'boolean'
      || (item.minimized !== undefined && typeof item.minimized !== 'boolean') || listed.has(item.id)) {
      throw new Error('INVALID_NATIVE_WINDOW_LIST');
    }
    listed.add(item.id);
    if (item.accessible && item.visible && !item.minimized) candidates.push(item.id);
  }
  const matches: NativeSnapshot[] = [];
  let disappeared = 0;
  for (const id of candidates) {
    let state: NativeSnapshot;
    try { state = await load(id); }
    catch (error) {
      if (!missingWindow(error)) throw error;
      disappeared++;
      continue;
    }
    confidentSnapshot(state, id);
    if (valid(state)) matches.push(state);
  }
  const counts = `verified=${matches.length}, accessibleVisible=${candidates.length}, disappeared=${disappeared}`;
  if (matches.length === 0) throw new Error(`PREPARED_WINDOW_NOT_FOUND: ${counts}. Prepare the dedicated sample folder in one visible window.`);
  if (matches.length > 1) throw new Error(`AMBIGUOUS_PREPARED_WINDOW: ${counts}. Keep exactly one prepared sample window; no arbitrary candidate was selected.`);
  return matches[0]!;
}
