import type { EditorState } from './reducer';
import { initialState } from './reducer';

const KEY = 'glance-layout-builder:v1';

/**
 * localStorage can throw outright (private windows, blocked site data), so
 * every access is guarded and failure just means "start fresh".
 */
export function load(): EditorState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initialState();
    const parsed = JSON.parse(raw) as EditorState;
    if (!parsed?.config?.pages?.length) return initialState();
    // A page whose id no longer exists would leave the canvas blank.
    const active = parsed.config.pages.some((p) => p.id === parsed.activePageId)
      ? parsed.activePageId
      : parsed.config.pages[0]!.id;
    return { ...parsed, activePageId: active };
  } catch {
    return initialState();
  }
}

export function save(state: EditorState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Nothing to do — the user just loses restore-on-refresh.
  }
}

export function clear(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
