import { createContext, useContext, useEffect, useMemo, useReducer, useState } from 'react';
import type { ReactNode } from 'react';
import type { Action, EditorState } from './reducer';
import { reducer } from './reducer';
import type { ResolvedCatalog, UploadedCatalog } from './catalogSource';
import { resolveCatalog, setActiveCatalog } from './catalogSource';
import type { SavedWidget } from './savedWidgets';
import { makeSaved } from './savedWidgets';
import type { WidgetInstance } from './types';
import { load, loadCatalog, loadSaved, save, saveCatalog, saveSaved } from './persist';

type Store = {
  state: EditorState;
  dispatch: (action: Action) => void;
  /** The widget menu, merged from the built-in catalog and any upload. */
  catalog: ResolvedCatalog;
  setCatalog: (uploaded: UploadedCatalog | null) => void;
  /** Widgets the user kept in the side panel, ready to place again. */
  saved: SavedWidget[];
  saveWidget: (widget: WidgetInstance, name: string) => void;
  removeSaved: (id: string) => void;
  renameSaved: (id: string, name: string) => void;
};

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  const [uploaded, setUploaded] = useState<UploadedCatalog | null>(loadCatalog);
  const [saved, setSaved] = useState<SavedWidget[]>(loadSaved);

  // Debounced so a drag or a burst of typing writes once, not per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => save(state), 300);
    return () => clearTimeout(timer);
  }, [state]);

  // Published to the module registry as it is derived, so the emitter,
  // validator and reducer resolve types against the same catalog the UI shows.
  const catalog = useMemo(() => {
    const resolved = resolveCatalog(uploaded);
    setActiveCatalog(resolved);
    return resolved;
  }, [uploaded]);

  const setCatalog = (next: UploadedCatalog | null) => {
    saveCatalog(next);
    setUploaded(next);
  };

  const commitSaved = (next: SavedWidget[]) => {
    saveSaved(next);
    setSaved(next);
  };

  const saveWidget = (widget: WidgetInstance, name: string) =>
    commitSaved([...saved, makeSaved(widget, name)]);
  const removeSaved = (id: string) => commitSaved(saved.filter((s) => s.id !== id));
  const renameSaved = (id: string, name: string) =>
    commitSaved(saved.map((s) => (s.id === id ? { ...s, name } : s)));

  const value = useMemo(
    () => ({ state, dispatch, catalog, setCatalog, saved, saveWidget, removeSaved, renameSaved }),
    [state, catalog, saved],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside <StoreProvider>');
  return store;
}

/** The page currently shown on the canvas. */
export function useActivePage() {
  const { state } = useStore();
  return state.config.pages.find((p) => p.id === state.activePageId) ?? state.config.pages[0]!;
}
