import type { Column, ColumnSize, Config, Page, WidgetInstance } from './types';
import type { ThemeConfig } from './theme';
import { newId } from './types';
import { WIDGETS_BY_TYPE } from '../catalog/widgets';
import { canAddColumn, canRemoveColumn, canSetColumnSize } from './validate';
import { extractWidget, mapWidgetList } from './tree';

export type EditorState = {
  config: Config;
  activePageId: string;
  selectedWidgetId: string | null;
};

export type Action =
  | { type: 'load'; state: EditorState }
  | { type: 'reset' }
  | { type: 'select-page'; pageId: string }
  | { type: 'add-page' }
  | { type: 'remove-page'; pageId: string }
  | { type: 'update-page'; pageId: string; patch: Partial<Omit<Page, 'id' | 'columns'>> }
  | { type: 'add-column'; pageId: string; size: ColumnSize }
  | { type: 'remove-column'; pageId: string; columnId: string }
  | { type: 'set-column-size'; pageId: string; columnId: string; size: ColumnSize }
  | { type: 'set-theme'; theme: ThemeConfig }
  | { type: 'select-widget'; widgetId: string | null }
  | {
      type: 'add-widget';
      pageId: string;
      columnId: string;
      parentId: string | null;
      widgetType: string;
      index?: number;
    }
  | {
      type: 'move-widget';
      widgetId: string;
      pageId: string;
      columnId: string;
      parentId: string | null;
      index: number;
    }
  | { type: 'remove-widget'; widgetId: string }
  | { type: 'duplicate-widget'; widgetId: string }
  | { type: 'set-prop'; widgetId: string; key: string; value: unknown };

export function newColumn(size: ColumnSize): Column {
  return { id: newId('col'), size, widgets: [] };
}

/** The small/full/small skeleton the Glance docs use for a new page. */
export function newPage(name: string): Page {
  return {
    id: newId('page'),
    name,
    columns: [newColumn('small'), newColumn('full'), newColumn('small')],
  };
}

export function newWidget(type: string): WidgetInstance {
  const def = WIDGETS_BY_TYPE.get(type);
  const widget: WidgetInstance = { id: newId('w'), type, props: {} };
  if (def?.container) widget.children = [];
  return widget;
}

export function initialState(): EditorState {
  const page = newPage('Home');
  return { config: { pages: [page] }, activePageId: page.id, selectedWidgetId: null };
}

/** Applies `fn` to one page, leaving the rest untouched. */
function withPage(state: EditorState, pageId: string, fn: (page: Page) => Page): EditorState {
  return {
    ...state,
    config: { ...state.config, pages: state.config.pages.map((p) => (p.id === pageId ? fn(p) : p)) },
  };
}

/** Applies `fn` to one column of one page. */
function withColumn(
  state: EditorState,
  pageId: string,
  columnId: string,
  fn: (column: Column) => Column,
): EditorState {
  return withPage(state, pageId, (page) => ({
    ...page,
    columns: page.columns.map((c) => (c.id === columnId ? fn(c) : c)),
  }));
}

function insertAt<T>(list: T[], item: T, index?: number): T[] {
  const next = [...list];
  next.splice(index === undefined ? next.length : Math.max(0, Math.min(index, next.length)), 0, item);
  return next;
}

/** Fresh ids for a widget and everything under it, so a copy is independent. */
function cloneWidget(widget: WidgetInstance): WidgetInstance {
  const copy: WidgetInstance = {
    id: newId('w'),
    type: widget.type,
    props: structuredClone(widget.props),
  };
  if (widget.children) copy.children = widget.children.map(cloneWidget);
  return copy;
}

export function reducer(state: EditorState, action: Action): EditorState {
  switch (action.type) {
    case 'load':
      return action.state;

    case 'reset':
      return initialState();

    case 'select-page':
      return { ...state, activePageId: action.pageId, selectedWidgetId: null };

    case 'add-page': {
      const page = newPage(`Page ${state.config.pages.length + 1}`);
      return {
        config: { ...state.config, pages: [...state.config.pages, page] },
        activePageId: page.id,
        selectedWidgetId: null,
      };
    }

    case 'remove-page': {
      // Glance requires at least one page, so refuse to remove the last.
      if (state.config.pages.length <= 1) return state;
      const pages = state.config.pages.filter((p) => p.id !== action.pageId);
      const active = state.activePageId === action.pageId ? pages[0]!.id : state.activePageId;
      return { config: { ...state.config, pages }, activePageId: active, selectedWidgetId: null };
    }

    case 'update-page':
      return withPage(state, action.pageId, (page) => ({ ...page, ...action.patch }));

    case 'add-column':
      return withPage(state, action.pageId, (page) =>
        canAddColumn(page, action.size)
          ? { ...page, columns: [...page.columns, newColumn(action.size)] }
          : page,
      );

    case 'remove-column':
      return withPage(state, action.pageId, (page) =>
        canRemoveColumn(page, action.columnId)
          ? { ...page, columns: page.columns.filter((c) => c.id !== action.columnId) }
          : page,
      );

    case 'set-column-size':
      return withPage(state, action.pageId, (page) =>
        canSetColumnSize(page, action.columnId, action.size)
          ? {
              ...page,
              columns: page.columns.map((c) =>
                c.id === action.columnId ? { ...c, size: action.size } : c,
              ),
            }
          : page,
      );

    case 'set-theme':
      return { ...state, config: { ...state.config, theme: action.theme } };

    case 'select-widget':
      return { ...state, selectedWidgetId: action.widgetId };

    case 'add-widget': {
      const widget = newWidget(action.widgetType);
      const next = withColumn(state, action.pageId, action.columnId, (column) => ({
        ...column,
        widgets: mapWidgetList(column.widgets, action.parentId, (list) =>
          insertAt(list, widget, action.index),
        ),
      }));
      return { ...next, selectedWidgetId: widget.id };
    }

    case 'move-widget': {
      let moved: WidgetInstance | undefined;

      // Lift the widget out of wherever it is, then drop it at the target.
      const lifted: Page[] = state.config.pages.map((page) => ({
        ...page,
        columns: page.columns.map((column) => {
          const result = extractWidget(column.widgets, action.widgetId);
          if (result.removed) moved = result.removed;
          return result.removed ? { ...column, widgets: result.widgets } : column;
        }),
      }));

      if (!moved) return state;
      const widget = moved;

      // A container may not be dropped into another container.
      if (action.parentId !== null && widget.children !== undefined) return state;

      return {
        ...state,
        config: {
          ...state.config,
          pages: lifted.map((page) =>
            page.id !== action.pageId
              ? page
              : {
                  ...page,
                  columns: page.columns.map((column) =>
                    column.id !== action.columnId
                      ? column
                      : {
                          ...column,
                          widgets: mapWidgetList(column.widgets, action.parentId, (list) =>
                            insertAt(list, widget, action.index),
                          ),
                        },
                  ),
                },
          ),
        },
      };
    }

    case 'remove-widget':
      return {
        ...state,
        selectedWidgetId: state.selectedWidgetId === action.widgetId ? null : state.selectedWidgetId,
        config: {
          ...state.config,
          pages: state.config.pages.map((page) => ({
            ...page,
            columns: page.columns.map((column) => ({
              ...column,
              widgets: extractWidget(column.widgets, action.widgetId).widgets,
            })),
          })),
        },
      };

    case 'duplicate-widget': {
      let copy: WidgetInstance | undefined;
      const pages = state.config.pages.map((page) => ({
        ...page,
        columns: page.columns.map((column) => ({
          ...column,
          widgets: duplicateIn(column.widgets, action.widgetId, (made) => {
            copy = made;
          }),
        })),
      }));
      return copy
        ? { ...state, config: { ...state.config, pages }, selectedWidgetId: copy.id }
        : state;
    }

    case 'set-prop': {
      const setProp = (list: WidgetInstance[]): WidgetInstance[] =>
        list.map((widget) => {
          if (widget.id === action.widgetId) {
            const props = { ...widget.props };
            if (action.value === undefined || action.value === '') delete props[action.key];
            else props[action.key] = action.value;
            return { ...widget, props };
          }
          return widget.children ? { ...widget, children: setProp(widget.children) } : widget;
        });

      return {
        ...state,
        config: {
          ...state.config,
          pages: state.config.pages.map((page) => ({
            ...page,
            columns: page.columns.map((column) => ({ ...column, widgets: setProp(column.widgets) })),
          })),
        },
      };
    }
  }
}

/** Inserts a copy directly after the original, wherever the original lives. */
function duplicateIn(
  widgets: WidgetInstance[],
  widgetId: string,
  report: (copy: WidgetInstance) => void,
): WidgetInstance[] {
  const out: WidgetInstance[] = [];
  for (const widget of widgets) {
    const next = widget.children
      ? { ...widget, children: duplicateIn(widget.children, widgetId, report) }
      : widget;
    out.push(next);
    if (widget.id === widgetId) {
      const copy = cloneWidget(widget);
      report(copy);
      out.push(copy);
    }
  }
  return out;
}
