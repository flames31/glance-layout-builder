/**
 * Estimated rendered height of a widget, in real Glance pixels.
 *
 * Deliberately kept out of `src/catalog/widgets.ts`: that file is transcribed
 * from the Glance source and stays diffable against it, whereas height is the
 * builder's own approximation and appears nowhere in Glance's config schema.
 *
 * Constants are read off Glance's stylesheets, where `html` is `font-size: 10px`
 * so 1rem == 10px (`static/css/main.css`):
 *
 *   --widget-gap:                      23px   gap between widgets in a column
 *   --widget-content-vertical-padding: 15px   top and bottom of .widget-content
 *   .widget-header                     1.4rem text + 0.9rem margin-bottom
 *   .list-gap-N                        N px between list items (the class name
 *                                      is the gap: --list-half-gap * 2)
 *   .expand-toggle-button              1.4rem text + 15px padding top/bottom
 *
 * These are approximations and are labelled as such in the UI. The one exact
 * case is `iframe`, which carries its own pixel height in the config.
 */

import type { WidgetInstance } from './types';
import { lookup } from './catalogSource';

export type SizeBasis =
  /** Computed from the widget's type and props. */
  | 'derived'
  /** Taken straight from the config; not an estimate. */
  | 'exact'
  /** Renders arbitrary content, so only the user can say. */
  | 'hint';

export type SizeEstimate = { px: number; basis: SizeBasis };

/** Gap Glance leaves between two widgets stacked in the same column. */
export const WIDGET_GAP = 23;

/** Height of an unknowable widget until the user says otherwise. */
export const DEFAULT_HINT_PX = 300;

const HEADER = 29; // 1.4rem line + 0.9rem margin-bottom
const PAD_Y = 30; // 15px top + 15px bottom
const EXPAND_BUTTON = 50; // 1.4rem line + 15px padding top/bottom

/** Chrome every widget carries: header plus the content box's own padding. */
const CHROME = HEADER + PAD_Y;

// ---------------------------------------------------------------- prop access

function num(props: Record<string, unknown>, key: string, fallback: number): number {
  const raw = props[key];
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function str(props: Record<string, unknown>, key: string, fallback: string): string {
  const raw = props[key];
  return typeof raw === 'string' && raw !== '' ? raw : fallback;
}

function count(props: Record<string, unknown>, key: string): number {
  const raw = props[key];
  return Array.isArray(raw) ? raw.length : 0;
}

/** A list of `rows` items each `item` tall, separated by `gap`. */
function list(rows: number, item: number, gap: number): number {
  if (rows <= 0) return 0;
  return rows * item + (rows - 1) * gap;
}

/**
 * How many rows a collapsible list actually shows.
 *
 * Glance treats a negative `collapse-after` as "never collapse"; otherwise the
 * list renders at most that many items behind a "show more" button.
 */
function visibleRows(
  props: Record<string, unknown>,
  defaultLimit: number,
  defaultCollapse: number,
): { rows: number; collapsed: boolean } {
  const limit = Math.max(0, num(props, 'limit', defaultLimit));
  const collapseAfter = num(props, 'collapse-after', defaultCollapse);
  if (collapseAfter < 0) return { rows: limit, collapsed: false };
  return { rows: Math.min(limit, collapseAfter), collapsed: limit > collapseAfter };
}

/** A collapsible list widget: title line plus a meta line per row. */
function feed(
  props: Record<string, unknown>,
  defaultLimit: number,
  defaultCollapse: number,
  itemHeight: number,
  gap = 14,
): number {
  const { rows, collapsed } = visibleRows(props, defaultLimit, defaultCollapse);
  return CHROME + list(rows, itemHeight, gap) + (collapsed ? EXPAND_BUTTON : 0);
}

// ------------------------------------------------------------------ per type

/** Row heights for the styles `rss` and the forum widgets can be rendered in. */
const FEED_ITEM: Record<string, number> = {
  'vertical-list': 36, // title line + meta line
  'detailed-list': 70, // title + description + meta
  'horizontal-cards': 190,
  'horizontal-cards-2': 160,
  'vertical-cards': 150,
  'grid-cards': 200,
};

function feedItemHeight(props: Record<string, unknown>, fallback = 'vertical-list'): number {
  const style = str(props, 'style', fallback);
  return FEED_ITEM[style] ?? FEED_ITEM['vertical-list']!;
}

/** Widgets whose height does not vary with any property we model. */
const FIXED: Record<string, number> = {
  calendar: 330,
  'calendar-legacy': 300,
  weather: 200,
  search: 90,
  'to-do': 260,
  'process-stats': 180,
  'server-stats': 180,
  'docker-containers': 200,
  'dns-stats': 330,
  repository: 220,
};

type Estimator = (props: Record<string, unknown>) => number;

const ESTIMATORS: Record<string, Estimator> = {
  rss: (p) => {
    // A per-feed `limit` overrides the widget-wide one for that feed, but the
    // widget-wide `limit` still caps the merged list, so it governs height.
    const style = str(p, 'style', 'vertical-list');
    const horizontal = style.startsWith('horizontal-cards');
    if (horizontal) return CHROME + (FEED_ITEM[style] ?? 190);
    return feed(p, 25, 5, feedItemHeight(p));
  },
  'hacker-news': (p) => feed(p, 15, 5, 36),
  lobsters: (p) => feed(p, 15, 5, 36),
  reddit: (p) => {
    const style = str(p, 'style', 'vertical-list');
    if (style !== 'vertical-list') return CHROME + (FEED_ITEM[style] ?? 150);
    const thumbnails = p['show-thumbnails'] === true;
    return feed(p, 15, 5, thumbnails ? 70 : 36);
  },
  releases: (p) => feed(p, 10, -1, 36),
  'change-detection': (p) => feed(p, 10, -1, 36),
  'twitch-channels': (p) => feed(p, 10, 5, 34),
  'twitch-top-games': (p) => feed(p, 10, 5, 34),

  monitor: (p) => {
    const sites = Math.max(1, count(p, 'sites'));
    // `dynamic-columns` packs sites side by side once the column is wide enough;
    // two per row is the common case on a `full` column.
    const perRow = str(p, 'style', 'compact') === 'dynamic-columns' ? 2 : 1;
    return CHROME + list(Math.ceil(sites / perRow), 22, 8);
  },
  markets: (p) => CHROME + list(Math.max(1, count(p, 'markets')), 40, 21),
  bookmarks: (p) => {
    const groups = Array.isArray(p['groups']) ? (p['groups'] as unknown[]) : [];
    if (groups.length === 0) return CHROME + 40;
    const rows = groups.reduce<number>((total, group) => {
      const links = group && typeof group === 'object' ? (group as Record<string, unknown>)['links'] : undefined;
      return total + 26 + list(Array.isArray(links) ? links.length : 0, 24, 8);
    }, 0);
    return CHROME + rows + (groups.length - 1) * 18;
  },
  clock: (p) => CHROME + 80 + list(count(p, 'timezones'), 24, 4),
  ical: (p) => CHROME + list(Math.max(1, Math.min(num(p, 'limit', 10), 6)), 40, 12),
  videos: (p) => {
    const style = str(p, 'style', 'horizontal-cards');
    const limit = Math.max(1, num(p, 'limit', 25));
    if (style === 'vertical-list') return CHROME + list(Math.min(limit, 10), 70, 14);
    if (style === 'grid-cards') return CHROME + list(Math.ceil(Math.min(limit, 12) / 3), 200, 14);
    return CHROME + 240; // horizontal-cards scrolls sideways
  },

  // Exact: the config states the height outright.
  iframe: (p) => num(p, 'height', 300),
};

/** Renders content that no amount of config inspection can measure. */
const UNKNOWABLE = new Set(['custom-api', 'html', 'extension']);

// -------------------------------------------------------------------- public

export function estimateHeight(widget: WidgetInstance): SizeEstimate {
  if (widget.type === 'iframe') {
    return { px: Math.max(50, num(widget.props, 'height', 300)), basis: 'exact' };
  }

  const def = lookup(widget.type);

  if (def?.container) {
    const children = widget.children ?? [];
    if (children.length === 0) return { px: CHROME + 40, basis: 'derived' };
    const heights = children.map((child) => estimateHeight(child).px);

    if (widget.type === 'group') {
      // Tabs overlay one another, so a group is as tall as its tallest child.
      return { px: HEADER + Math.max(...heights), basis: 'derived' };
    }
    // split-column spreads its children across sub-columns.
    const columns = Math.max(2, num(widget.props, 'max-columns', 2));
    const total = heights.reduce((a, b) => a + b, 0) + (children.length - 1) * WIDGET_GAP;
    return { px: Math.ceil(total / columns), basis: 'derived' };
  }

  if (UNKNOWABLE.has(widget.type) || def === undefined) {
    return { px: widget.heightHint ?? DEFAULT_HINT_PX, basis: 'hint' };
  }

  const estimator = ESTIMATORS[widget.type];
  if (estimator) return { px: Math.round(estimator(widget.props)), basis: 'derived' };

  const fixed = FIXED[widget.type];
  if (fixed !== undefined) return { px: fixed, basis: 'derived' };

  // A known type we have no model for yet; let the user correct it.
  return { px: widget.heightHint ?? DEFAULT_HINT_PX, basis: 'hint' };
}

/** Total height of a column, including the gap Glance leaves between widgets. */
export function estimateColumn(widgets: WidgetInstance[]): number {
  if (widgets.length === 0) return 0;
  const total = widgets.reduce((sum, w) => sum + estimateHeight(w).px, 0);
  return total + (widgets.length - 1) * WIDGET_GAP;
}
