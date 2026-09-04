import { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import type { ReactNode } from 'react';
import type { Action, EditorState } from './reducer';
import { reducer } from './reducer';
import { load, save } from './persist';

type Store = { state: EditorState; dispatch: (action: Action) => void };

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);

  // Debounced so a drag or a burst of typing writes once, not per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => save(state), 300);
    return () => clearTimeout(timer);
  }, [state]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
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
