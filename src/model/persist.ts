import type { EditorState } from './reducer';
import { initialState } from './reducer';
import type { UploadedCatalog } from './catalogSource';
import { parseCatalogFile } from './catalogSource';
import type { SavedWidget } from './savedWidgets';
import { parseSaved } from './savedWidgets';

const KEY = 'glance-layout-builder:v1';
const CATALOG_KEY = 'glance-layout-builder:catalog:v1';
const SAVED_KEY = 'glance-layout-builder:saved:v1';

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

/**
 * The uploaded catalog is kept separately from the layout: it describes the
 * user's Glance build, not their work in progress, so Reset should not discard
 * it and it survives independently of the config.
 */
export function loadCatalog(): UploadedCatalog | null {
  try {
    const raw = localStorage.getItem(CATALOG_KEY);
    if (!raw) return null;
    const result = parseCatalogFile(raw);
    return result.ok ? result.catalog : null;
  } catch {
    return null;
  }
}

export function saveCatalog(catalog: UploadedCatalog | null): void {
  try {
    if (catalog === null) localStorage.removeItem(CATALOG_KEY);
    else localStorage.setItem(CATALOG_KEY, JSON.stringify(catalog));
  } catch {
    /* ignore */
  }
}

/** Saved palette widgets, kept alongside the catalog rather than the layout. */
export function loadSaved(): SavedWidget[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    return raw ? parseSaved(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

export function saveSaved(widgets: SavedWidget[]): void {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(widgets));
  } catch {
    /* ignore */
  }
}
