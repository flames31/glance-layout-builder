import type { Column, Config, Page, WidgetInstance } from './types';

/** Where a widget sits: a column, or inside a container widget in that column. */
export type WidgetLocation = {
  pageId: string;
  columnId: string;
  parentId: string | null;
  index: number;
};

export function findPage(config: Config, pageId: string): Page | undefined {
  return config.pages.find((p) => p.id === pageId);
}

export function findColumn(page: Page, columnId: string): Column | undefined {
  return page.columns.find((c) => c.id === columnId);
}

/** Depth-first walk over every widget on a page, including container children. */
export function* walkWidgets(
  page: Page,
): Generator<{ widget: WidgetInstance; location: WidgetLocation }> {
  for (const column of page.columns) {
    yield* walkList(column.widgets, page.id, column.id, null);
  }
}

function* walkList(
  widgets: WidgetInstance[],
  pageId: string,
  columnId: string,
  parentId: string | null,
): Generator<{ widget: WidgetInstance; location: WidgetLocation }> {
  for (const [index, widget] of widgets.entries()) {
    yield { widget, location: { pageId, columnId, parentId, index } };
    if (widget.children) {
      yield* walkList(widget.children, pageId, columnId, widget.id);
    }
  }
}

export function locateWidget(config: Config, widgetId: string): WidgetLocation | undefined {
  for (const page of config.pages) {
    for (const entry of walkWidgets(page)) {
      if (entry.widget.id === widgetId) return entry.location;
    }
  }
  return undefined;
}

export function getWidget(config: Config, widgetId: string): WidgetInstance | undefined {
  for (const page of config.pages) {
    for (const entry of walkWidgets(page)) {
      if (entry.widget.id === widgetId) return entry.widget;
    }
  }
  return undefined;
}

/**
 * Returns a copy of `widgets` with `fn` applied to the list that contains
 * `containerId` (or the top level when it is null). Used by every mutation so
 * the tree stays immutable without a deep-clone library.
 */
export function mapWidgetList(
  widgets: WidgetInstance[],
  containerId: string | null,
  fn: (list: WidgetInstance[]) => WidgetInstance[],
): WidgetInstance[] {
  if (containerId === null) return fn(widgets);
  return widgets.map((widget) => {
    if (widget.id === containerId) {
      return { ...widget, children: fn(widget.children ?? []) };
    }
    if (widget.children) {
      return { ...widget, children: mapWidgetList(widget.children, containerId, fn) };
    }
    return widget;
  });
}

/** Removes `widgetId` wherever it is, returning the new list and the widget. */
export function extractWidget(
  widgets: WidgetInstance[],
  widgetId: string,
): { widgets: WidgetInstance[]; removed: WidgetInstance | undefined } {
  let removed: WidgetInstance | undefined;
  const next: WidgetInstance[] = [];

  for (const widget of widgets) {
    if (widget.id === widgetId) {
      removed = widget;
      continue;
    }
    if (widget.children) {
      const inner = extractWidget(widget.children, widgetId);
      if (inner.removed) removed = inner.removed;
      next.push({ ...widget, children: inner.widgets });
    } else {
      next.push(widget);
    }
  }

  return { widgets: next, removed };
}
