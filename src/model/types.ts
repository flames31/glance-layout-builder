/**
 * The editor's in-memory representation of a Glance config.
 *
 * `id` fields exist only so React and dnd-kit have stable keys; they are
 * stripped by the YAML emitter and never appear in the exported config.
 */

import type { ThemeConfig } from './theme';

export type PageWidth = 'default' | 'slim' | 'wide';
export type ColumnSize = 'small' | 'full';

export type WidgetInstance = {
  id: string;
  /** Exact Glance `type:` value, e.g. "rss". */
  type: string;
  /** Only values the user actually set; defaults are never stored. */
  props: Record<string, unknown>;
  /** Present only for container widgets (`group`, `split-column`). */
  children?: WidgetInstance[];
};

export type Column = {
  id: string;
  size: ColumnSize;
  widgets: WidgetInstance[];
};

export type Page = {
  id: string;
  name: string;
  /** Auto-derived from `name` unless the user overrides it. */
  slug?: string;
  width?: PageWidth;
  hideDesktopNavigation?: boolean;
  centerVertically?: boolean;
  columns: Column[];
};

export type Config = {
  /** Top-level `theme:` block. Omitted from the export when untouched. */
  theme?: ThemeConfig;
  pages: Page[];
};

let idCounter = 0;

/**
 * Editor-local id. Deliberately not a UUID: ids never leave the browser and
 * a counter keeps localStorage snapshots readable during debugging.
 */
export function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}
