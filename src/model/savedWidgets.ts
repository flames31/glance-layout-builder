/**
 * Widgets the user has kept in the side panel.
 *
 * A pasted widget is only useful once — it lands on the canvas and then there
 * is no way to place a second one without pasting again. Keeping it here turns
 * it into a palette entry: configured once, dragged in as often as wanted.
 *
 * These are widget *instances* rather than catalog definitions. A saved entry
 * carries the properties already filled in, which is the whole point — the
 * catalog knows what an `rss` widget is, this knows what *your* rss widget is.
 * They are client-side only and never leave the browser.
 */

import type { WidgetInstance } from './types';
import { newId } from './types';
import { cloneWidget } from './reducer';

export type SavedWidget = {
  id: string;
  name: string;
  /** The widget as configured, minus its editor id. */
  widget: WidgetInstance;
};

/** Falls back through title, then catalog label, then the raw type. */
export function suggestName(widget: WidgetInstance, label?: string): string {
  const title = widget.props['title'];
  if (typeof title === 'string' && title.trim() !== '') return title.trim();
  return label ?? widget.type;
}

export function makeSaved(widget: WidgetInstance, name: string): SavedWidget {
  return { id: newId('saved'), name, widget: cloneWidget(widget) };
}

/** A fresh copy to drop on the canvas, leaving the stored one untouched. */
export function instantiate(saved: SavedWidget): WidgetInstance {
  return cloneWidget(saved.widget);
}

/** Ignores anything that does not look like a saved widget, rather than throwing. */
export function parseSaved(raw: unknown): SavedWidget[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (entry): entry is SavedWidget =>
      typeof entry?.id === 'string' &&
      typeof entry?.name === 'string' &&
      typeof entry?.widget?.type === 'string',
  );
}
