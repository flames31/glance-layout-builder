/**
 * Reads an existing `glance.yml` back into the editor.
 *
 * The point is to lay out a dashboard you already run, so this is deliberately
 * lenient where `importWidgetYaml` is strict. A config that Glance is serving
 * right now must load, even when this builder does not recognise every widget
 * in it — a fork type, or one added upstream since the catalog was written.
 * Those import intact and are reported as warnings rather than refused, and the
 * emitter passes their properties back out untouched.
 *
 * Only structural problems — no pages, a page with no columns — are errors,
 * because there is no sensible editor state on the other side of them.
 */

import { parse } from 'yaml';
import type { Column, Config, Page, PageWidth, WidgetInstance } from './types';
import { newId } from './types';
import type { ThemeConfig } from './theme';
import { parseHsl } from './theme';
import { lookup } from './catalogSource';
import { slugify } from '../export/toYaml';

export type ImportConfigResult =
  | { ok: true; config: Config; warnings: string[] }
  | { ok: false; errors: string[] };

type Mapping = Record<string, unknown>;

function isMapping(value: unknown): value is Mapping {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return undefined;
}

// ----------------------------------------------------------------- widgets

function readWidget(entry: unknown, warn: (message: string) => void): WidgetInstance | undefined {
  if (!isMapping(entry)) {
    warn('Skipped a widget that was not a mapping.');
    return undefined;
  }

  const type = asString(entry['type']);
  if (!type) {
    warn('Skipped a widget with no `type`.');
    return undefined;
  }

  const props: Mapping = {};
  for (const [key, value] of Object.entries(entry)) {
    if (key === 'type' || key === 'widgets') continue;
    props[key] = value;
  }

  const widget: WidgetInstance = { id: newId('w'), type, props };

  // Trust the file's own shape over the catalog's: a `widgets:` key means a
  // container, whether or not this build knows the type.
  const nested = entry['widgets'];
  if (Array.isArray(nested)) {
    widget.children = nested
      .map((child) => readWidget(child, warn))
      .filter((child): child is WidgetInstance => child !== undefined);
  } else if (lookup(type)?.container) {
    widget.children = [];
  }

  return widget;
}

// ----------------------------------------------------------------- columns

function readColumn(entry: unknown, warn: (message: string) => void): Column {
  const source = isMapping(entry) ? entry : {};
  const size = source['size'];

  let resolved: Column['size'];
  if (size === 'small' || size === 'full') {
    resolved = size;
  } else {
    resolved = 'full';
    warn(`A column had size "${String(size)}"; treated as full.`);
  }

  const widgets = Array.isArray(source['widgets'])
    ? (source['widgets'] as unknown[])
        .map((w) => readWidget(w, warn))
        .filter((w): w is WidgetInstance => w !== undefined)
    : [];

  return { id: newId('col'), size: resolved, widgets };
}

// ------------------------------------------------------------------- pages

const WIDTHS: PageWidth[] = ['default', 'slim', 'wide'];

function readPage(entry: unknown, index: number, warn: (m: string) => void, fail: (m: string) => void): Page | undefined {
  if (!isMapping(entry)) {
    fail(`Page ${index + 1} is not a mapping.`);
    return undefined;
  }

  const name = asString(entry['name']) ?? `Page ${index + 1}`;
  if (!asString(entry['name'])) warn(`Page ${index + 1} had no name; called it "${name}".`);

  const columns = Array.isArray(entry['columns'])
    ? (entry['columns'] as unknown[]).map((c) => readColumn(c, warn))
    : [];
  if (columns.length === 0) {
    fail(`Page "${name}" has no columns.`);
    return undefined;
  }

  const page: Page = { id: newId('page'), name, columns };

  // Only keep a slug that differs from the one Glance would derive anyway.
  const slug = asString(entry['slug']);
  if (slug && slug !== slugify(name)) page.slug = slug;

  const width = entry['width'];
  if (typeof width === 'string' && (WIDTHS as string[]).includes(width)) {
    if (width !== 'default') page.width = width as PageWidth;
  } else if (width !== undefined) {
    warn(`Page "${name}" had width "${String(width)}"; using the default.`);
  }

  if (entry['center-vertically'] === true) page.centerVertically = true;
  if (entry['hide-desktop-navigation'] === true) page.hideDesktopNavigation = true;

  return page;
}

// ------------------------------------------------------------------- theme

function readTheme(entry: unknown, warn: (m: string) => void): ThemeConfig | undefined {
  if (!isMapping(entry)) return undefined;

  const theme: ThemeConfig = {};
  if (entry['light'] === true) theme.light = true;

  const colors = [
    ['background-color', 'backgroundColor'],
    ['primary-color', 'primaryColor'],
    ['positive-color', 'positiveColor'],
    ['negative-color', 'negativeColor'],
  ] as const;

  for (const [key, field] of colors) {
    if (entry[key] === undefined) continue;
    const parsed = parseHsl(entry[key]);
    if (parsed) theme[field] = parsed;
    else warn(`Could not read theme ${key} "${String(entry[key])}"; left it unset.`);
  }

  const contrast = asNumber(entry['contrast-multiplier']);
  if (contrast !== undefined) theme.contrastMultiplier = contrast;
  const saturation = asNumber(entry['text-saturation-multiplier']);
  if (saturation !== undefined) theme.textSaturationMultiplier = saturation;

  if (entry['presets'] !== undefined) {
    warn('Theme `presets` are not editable here and were dropped.');
  }

  return Object.keys(theme).length > 0 ? theme : undefined;
}

// ------------------------------------------------------------------ public

export function importConfigYaml(text: string): ImportConfigResult {
  if (text.trim() === '') return { ok: false, errors: ['Nothing to import — paste a config first.'] };

  let parsed: unknown;
  try {
    parsed = parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, errors: [`Could not parse as YAML — ${message}`] };
  }

  if (!isMapping(parsed)) {
    return { ok: false, errors: ['Expected a glance.yml document with a `pages:` key.'] };
  }
  if (!Array.isArray(parsed['pages']) || parsed['pages'].length === 0) {
    return { ok: false, errors: ['No `pages:` found. This does not look like a glance.yml.'] };
  }

  const warnings: string[] = [];
  const errors: string[] = [];
  const warn = (message: string) => {
    if (!warnings.includes(message)) warnings.push(message);
  };
  const fail = (message: string) => errors.push(message);

  const pages = (parsed['pages'] as unknown[])
    .map((page, i) => readPage(page, i, warn, fail))
    .filter((page): page is Page => page !== undefined);

  if (errors.length > 0) return { ok: false, errors };
  if (pages.length === 0) return { ok: false, errors: ['No usable pages in that config.'] };

  const config: Config = { pages };
  const theme = readTheme(parsed['theme'], warn);
  if (theme) config.theme = theme;

  // Report unrecognised types once, at the end, with what to do about it.
  const unknown = new Set<string>();
  const walk = (widgets: WidgetInstance[]) => {
    for (const widget of widgets) {
      const def = lookup(widget.type);
      if (!def || !def.available) unknown.add(widget.type);
      if (widget.children) walk(widget.children);
    }
  };
  for (const page of pages) for (const column of page.columns) walk(column.widgets);

  if (unknown.size > 0) {
    warn(
      `Imported ${unknown.size} widget type(s) this builder does not know: ${[...unknown].join(', ')}. ` +
        'They keep every property and export unchanged; generate a catalog from your Glance to edit their fields.',
    );
  }

  for (const key of ['server', 'auth', 'branding', 'document']) {
    if (parsed[key] !== undefined) {
      warn(`\`${key}:\` is not editable here and was dropped — keep it from your original file.`);
    }
  }

  return { ok: true, config, warnings };
}
