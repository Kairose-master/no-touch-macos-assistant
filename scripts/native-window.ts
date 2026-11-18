import { nodes, type CLIEnvelope, type NativeSnapshot } from '../agent/lib/native-cli.ts';

export function preparedNotesFolder(state: NativeSnapshot, folder: string) {
  return state.complete && state.tree.name === folder && nodes(state).filter(node =>
    node.role === 'cell' && node.states?.includes('selected') && node.name?.startsWith(folder + ',')
  ).length === 1;
}

// Window-list titles and accessibility titles can differ. Prove the selected
// sample folder from each visible window's AX snapshot, without clicking it.
export async function findPreparedNotesWindow(
  folder: string,
  list: () => Promise<CLIEnvelope>,
  read: (id: string) => Promise<NativeSnapshot>,
) {
  const result = await list();
  if (!result.ok) throw new Error(`NATIVE_WINDOW_LIST_FAILED: ${result.error?.code ?? 'UNKNOWN'}. Run npm run preflight in this same terminal; no window was selected.`);
  if (!Array.isArray(result.data)) throw new Error('INVALID_NATIVE_WINDOW_LIST: no window was selected.');
  const visible = result.data.filter((item: { id: string; accessible: boolean; visible: boolean; minimized?: boolean }) =>
    item.accessible && item.visible && !item.minimized && /^w-[\w-]+$/.test(item.id)
  ) as { id: string }[];
  if (visible.length > 10) throw new Error('TOO_MANY_NOTES_WINDOWS: prepare a smaller set of visible Notes windows.');
  const matches: string[] = [];
  for (const window of visible) {
    const state = await read(window.id);
    if (state.window?.id !== window.id) throw new Error('NATIVE_WINDOW_MISMATCH: no window was selected.');
    if (preparedNotesFolder(state, folder)) matches.push(window.id);
  }
  if (matches.length !== 1) throw new Error(`PREPARE_UNIQUE_SAMPLE_WINDOW: com.apple.Notes / ${folder}; verified=${matches.length}, accessibleVisible=${visible.length}. Select this folder in one Notes main window. If no windows are accessible, run npm run preflight in this same terminal. No arbitrary candidate was selected.`);
  return matches[0]!;
}
