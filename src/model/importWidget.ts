/**
 * Turns a pasted `glance.yml` widget snippet into editor widgets.
 *
 * Written for the way community widgets are actually distributed — as a fenced
 * block starting `- type: custom-api` that you copy into your config. The point
 * is to place someone else's widget in a layout without retyping it, so every
 * property is kept verbatim; the emitter passes back out the ones the catalog
 * does not model.
 *
 * Validation is deliberately strict about the one thing Glance rejects outright:
 * an unknown `type`. `newWidget` in `internal/glance/widget.go` fails config
 * parsing with `unknown widget type: %s`, so a snippet naming a type this build
 * does not have would break the user's dashboard, and is refused here instead.
 */

import { parse } from 'yaml';
import type { WidgetInstance } from './types';
import { newId } from './types';
import { lookup } from './catalogSource';

export type ImportResult =
  | { ok: true; widgets: WidgetInstance[] }
  | { ok: false; errors: string[] };

type Mapping = Record<string, unknown>;

function isMapping(value: unknown): value is Mapping {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Snippets turn up in three shapes: a bare list of widgets (the common case), a
 * single widget on its own, and occasionally a fragment still wrapped in the
 * `widgets:` key it would sit under in a column.
 */
function toEntries(parsed: unknown): unknown[] | undefined {
  if (Array.isArray(parsed)) return parsed;
  if (!isMapping(parsed)) return undefined;
  if (Array.isArray(parsed['widgets']) && parsed['type'] === undefined) {
    return parsed['widgets'] as unknown[];
  }
  return [parsed];
}

function readWidget(entry: unknown, path: string, nested: boolean, errors: string[]): WidgetInstance | undefined {
  if (!isMapping(entry)) {
    errors.push(`${path}: expected a widget mapping, found ${Array.isArray(entry) ? 'a list' : typeof entry}.`);
    return undefined;
  }

  const type = entry['type'];
  if (typeof type !== 'string' || type.trim() === '') {
    errors.push(`${path}: missing a \`type\`. Every Glance widget needs one.`);
    return undefined;
  }

  const def = lookup(type);
  if (!def || !def.available) {
    errors.push(`${path}: unknown widget type \`${type}\` — your Glance build would reject this config.`);
    return undefined;
  }

  if (nested && def.container) {
    errors.push(`${path}: \`${type}\` is a container, and Glance does not allow one inside another.`);
    return undefined;
  }

  const props: Mapping = {};
  for (const [key, value] of Object.entries(entry)) {
    if (key === 'type' || key === 'widgets') continue;
    props[key] = value;
  }

  const widget: WidgetInstance = { id: newId('w'), type, props };

  if (def.container) {
    const raw = entry['widgets'];
    const children: WidgetInstance[] = [];
    if (raw !== undefined && !Array.isArray(raw)) {
      errors.push(`${path}: \`widgets\` must be a list.`);
    } else {
      (raw ?? []).forEach((child: unknown, i: number) => {
        const parsed = readWidget(child, `${path} › widgets[${i}]`, true, errors);
        if (parsed) children.push(parsed);
      });
    }
    widget.children = children;
  }

  return widget;
}

export function importWidgetYaml(text: string): ImportResult {
  if (text.trim() === '') return { ok: false, errors: ['Nothing to import — paste a widget first.'] };

  let parsed: unknown;
  try {
    parsed = parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, errors: [`Could not parse as YAML — ${message}`] };
  }

  const entries = toEntries(parsed);
  if (entries === undefined) {
    return {
      ok: false,
      errors: ['Expected a widget or a list of widgets, like the snippets in a widget README.'],
    };
  }
  if (entries.length === 0) return { ok: false, errors: ['No widgets found in that snippet.'] };

  const errors: string[] = [];
  const widgets: WidgetInstance[] = [];
  entries.forEach((entry, i) => {
    const label = entries.length === 1 ? 'widget' : `widget ${i + 1}`;
    const widget = readWidget(entry, label, false, errors);
    if (widget) widgets.push(widget);
  });

  // All or nothing: a partial import would silently drop widgets the user can
  // see in the text they pasted.
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, widgets };
}
