import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import type { WidgetInstance } from './model/types';
import type { SavedWidget } from './model/savedWidgets';
import { instantiate, suggestName } from './model/savedWidgets';
import { StoreProvider, useActivePage, useStore } from './model/store';
import { decodeListId, decodeNewId, decodeSavedId } from './model/dragIds';
import { getWidget } from './model/tree';
import { pageIssues } from './model/validate';
import { clear } from './model/persist';
import { Palette } from './components/Palette';
import { Canvas } from './components/Canvas';
import { PageTabs } from './components/PageTabs';
import { Inspector } from './components/Inspector';
import { ExportPanel } from './components/ExportPanel';
import { PastePanel } from './components/PastePanel';
import { CatalogPanel } from './components/CatalogPanel';
import { ImportPanel } from './components/ImportPanel';
import { ThemePanel } from './components/ThemePanel';
import { isThemeEmpty } from './model/theme';

export default function App() {
  return (
    <StoreProvider>
      <Editor />
    </StoreProvider>
  );
}

/** Where a drop landed: which widget list, and at what index. */
type DropTarget = { pageId: string; columnId: string; parentId: string | null; index: number };

function resolveDropTarget(over: DragEndEvent['over']): DropTarget | null {
  if (!over) return null;

  // Dropped onto another widget — take that widget's list and position.
  const sortable = over.data.current?.['sortable'] as
    | { containerId: string; index: number }
    | undefined;
  if (sortable) {
    const list = decodeListId(sortable.containerId);
    return list ? { ...list, index: sortable.index } : null;
  }

  // Dropped onto empty space in a list — append.
  const list = decodeListId(String(over.id));
  return list ? { ...list, index: Number.MAX_SAFE_INTEGER } : null;
}

function Editor() {
  const { state, dispatch, catalog, saved, saveWidget } = useStore();
  const page = useActivePage();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [showTheme, setShowTheme] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const sensors = useSensors(
    // A small threshold so palette items stay clickable as well as draggable.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const issues = useMemo(() => pageIssues(page, state.config.pages), [page, state.config.pages]);

  // Delete removes the selected widget, unless the user is typing in a form.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable;
      if (typing) return;

      if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedWidgetId) {
        e.preventDefault();
        dispatch({ type: 'remove-widget', widgetId: state.selectedWidgetId });
      }
      if (e.key === 'Escape') dispatch({ type: 'select-widget', widgetId: null });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [state.selectedWidgetId, dispatch]);

  const onDragStart = (event: DragStartEvent) => setDraggingId(String(event.active.id));

  const onDragEnd = (event: DragEndEvent) => {
    setDraggingId(null);
    const target = resolveDropTarget(event.over);
    if (!target) return;

    const activeId = String(event.active.id);

    const savedId = decodeSavedId(activeId);
    if (savedId !== null) {
      const entry = saved.find((s) => s.id === savedId);
      if (!entry) return;
      const widget = instantiate(entry);
      if (target.parentId !== null && widget.children !== undefined) return;
      dispatch({
        type: 'add-widget',
        pageId: target.pageId,
        columnId: target.columnId,
        parentId: target.parentId,
        widgetType: widget.type,
        index: target.index,
        seed: widget,
      });
      return;
    }

    const newType = decodeNewId(activeId);

    if (newType !== null) {
      // Containers cannot be nested inside other containers.
      if (target.parentId !== null && catalog.byType.get(newType)?.container) return;
      dispatch({
        type: 'add-widget',
        pageId: target.pageId,
        columnId: target.columnId,
        parentId: target.parentId,
        widgetType: newType,
        index: target.index,
      });
      return;
    }

    if (activeId === target.parentId) return; // dropped into itself
    dispatch({ type: 'move-widget', widgetId: activeId, ...target });
  };

  const draggingWidget = draggingId ? getWidget(state.config, draggingId) : undefined;
  const draggingNewType = draggingId ? decodeNewId(draggingId) : null;
  const draggingSavedId = draggingId ? decodeSavedId(draggingId) : null;
  const draggingSaved = draggingSavedId ? saved.find((s) => s.id === draggingSavedId) : undefined;

  /** Palette click adds to the first column that can take the widget. */
  const addFromPalette = (type: string) => {
    const column = page.columns[0];
    if (!column) return;
    dispatch({
      type: 'add-widget',
      pageId: page.id,
      columnId: column.id,
      parentId: null,
      widgetType: type,
    });
  };

  const addSeed = (widget: WidgetInstance) => {
    const column = page.columns[0];
    if (!column) return;
    dispatch({
      type: 'add-widget',
      pageId: page.id,
      columnId: column.id,
      parentId: null,
      widgetType: widget.type,
      seed: widget,
    });
  };

  /**
   * Pasted widgets land on the canvas and are also kept in the side panel, so a
   * second copy never means pasting the same YAML again.
   */
  const addPasted = (widgets: WidgetInstance[]) => {
    for (const widget of widgets) {
      addSeed(widget);
      saveWidget(widget, suggestName(widget, catalog.byType.get(widget.type)?.label));
    }
  };

  const addSaved = (entry: SavedWidget) => addSeed(instantiate(entry));

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDraggingId(null)}
    >
      <div className="app">
        <div className="topbar">
          <h1>GLANCE LAYOUT BUILDER</h1>
          <PageTabs />
          <span className="spacer" />
          <button
            className="ghost"
            title="Load an existing glance.yml and rearrange it here"
            onClick={() => setShowImport(true)}
          >
            Import
          </button>
          <button
            className="ghost"
            title="Match the widget menu to your own Glance build"
            onClick={() => setShowCatalog(true)}
          >
            {catalog.source
              ? `Catalog: ${catalog.source.label}${catalog.source.commit ? ` @ ${catalog.source.commit}` : ''}`
              : 'Catalog: built-in'}
          </button>
          <button
            className="ghost"
            title="Pick or customise the theme of the exported dashboard"
            onClick={() => setShowTheme(true)}
          >
            Theme{!isThemeEmpty(state.config.theme) && ' ●'}
          </button>
          <button
            className="ghost"
            title="Discard everything and start from an empty page"
            onClick={() => {
              if (confirm('Discard the current layout and start over?')) {
                clear();
                dispatch({ type: 'reset' });
              }
            }}
          >
            Reset
          </button>
          <button className="primary" onClick={() => setShowExport(true)}>
            Export YAML
          </button>
        </div>

        <div className="panes">
          <aside className="pane-left">
            <div className="pane-title">Widgets</div>
            <Palette
              onAdd={addFromPalette}
              onAddSaved={addSaved}
              onPaste={() => setShowPaste(true)}
            />
          </aside>

          <main className="pane-main">
            <Canvas page={page} />
            {issues.length > 0 && (
              <div className="issues" style={{ marginTop: 16 }}>
                <h3>{issues.length} issue(s) on this page</h3>
                <ul>
                  {issues.map((issue, i) => (
                    <li
                      key={i}
                      onClick={() =>
                        issue.widgetId &&
                        dispatch({ type: 'select-widget', widgetId: issue.widgetId })
                      }
                    >
                      {issue.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </main>

          <aside className="pane-right">
            <Inspector page={page} />
          </aside>
        </div>
      </div>

      <DragOverlay className="drag-overlay">
        {draggingWidget ? (
          <div className="widget-card">
            <div className="row">
              <span className="grip">⠿</span>
              <span className="label">
                {catalog.byType.get(draggingWidget.type)?.label ?? draggingWidget.type}
              </span>
            </div>
          </div>
        ) : draggingSaved ? (
          <div className="widget-card">
            <div className="row">
              <span className="label">{draggingSaved.name}</span>
            </div>
          </div>
        ) : draggingNewType ? (
          <div className="widget-card">
            <div className="row">
              <span className="label">{catalog.byType.get(draggingNewType)?.label}</span>
            </div>
          </div>
        ) : null}
      </DragOverlay>

      {showImport && <ImportPanel onClose={() => setShowImport(false)} />}
      {showCatalog && <CatalogPanel onClose={() => setShowCatalog(false)} />}
      {showPaste && (
        <PastePanel onImport={addPasted} onClose={() => setShowPaste(false)} />
      )}
      {showTheme && <ThemePanel onClose={() => setShowTheme(false)} />}
      {showExport && <ExportPanel onClose={() => setShowExport(false)} />}
    </DndContext>
  );
}
