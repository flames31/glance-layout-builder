import type { Column, ColumnSize, Config, Page, WidgetInstance } from './types';
import type { FieldDef } from '../catalog/types';
import type { HSL, ThemeConfig } from './theme';
import { isThemeEmpty, isValidHsl } from './theme';
import { DURATION_PATTERN } from '../catalog/types';
import { WIDGETS_BY_TYPE } from '../catalog/widgets';
import { slugify } from '../export/toYaml';
import { walkWidgets } from './tree';

/**
 * Glance's own config validation, transcribed from `isConfigStateValid`
 * (internal/glance/config.go) so the editor cannot produce a config the real
 * parser would reject.
 */

export type Issue = {
  message: string;
  pageId?: string;
  widgetId?: string;
};

/** Slugs Glance reserves for its auth routes. */
const RESERVED_SLUGS = new Set(['login', 'logout']);

export function maxColumns(page: Page): number {
  return page.width === 'slim' ? 2 : 3;
}

export function countFull(columns: Column[]): number {
  return columns.filter((c) => c.size === 'full').length;
}

/** A page must end up with 1 or 2 full columns and at most 3 (2 if slim) total. */
export function canAddColumn(page: Page, size: ColumnSize): boolean {
  if (page.columns.length >= maxColumns(page)) return false;
  if (size === 'full' && countFull(page.columns) >= 2) return false;
  return true;
}

export function canRemoveColumn(page: Page, columnId: string): boolean {
  const remaining = page.columns.filter((c) => c.id !== columnId);
  if (remaining.length === 0) return false;
  const full = countFull(remaining);
  return full >= 1 && full <= 2;
}

export function canSetColumnSize(page: Page, columnId: string, size: ColumnSize): boolean {
  const next = page.columns.map((c) => (c.id === columnId ? { ...c, size } : c));
  const full = countFull(next);
  return full >= 1 && full <= 2;
}

/** Names of required fields the user has not filled in. */
export function missingRequiredFields(widget: WidgetInstance): string[] {
  const def = WIDGETS_BY_TYPE.get(widget.type);
  if (!def) return [];
  return def.fields.filter((f) => f.required && isBlank(f, widget.props[f.key])).map((f) => f.label);
}

function isBlank(field: FieldDef, value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) {
    if (value.length === 0) return true;
    if (field.kind === 'objectList') {
      // A row of entirely empty inputs does not count as filled in.
      return value.every((row) =>
        field.fields.every((sub) => isBlank(sub, (row as Record<string, unknown>)?.[sub.key])),
      );
    }
    return value.every((v) => typeof v === 'string' && v.trim() === '');
  }
  return false;
}

export function pageIssues(page: Page, allPages: Page[]): Issue[] {
  const issues: Issue[] = [];
  const at = (message: string) => issues.push({ message, pageId: page.id });

  if (page.name.trim() === '') at('Page has no name.');

  if (page.columns.length === 0) {
    at('Page has no columns.');
  } else {
    if (page.columns.length > maxColumns(page)) {
      at(
        page.width === 'slim'
          ? 'A slim page cannot have more than 2 columns.'
          : 'A page cannot have more than 3 columns.',
      );
    }
    const full = countFull(page.columns);
    if (full === 0) at('Page needs at least one full-width column.');
    if (full > 2) at('Page cannot have more than 2 full-width columns.');
  }

  const slug = page.slug?.trim() || slugify(page.name);
  if (RESERVED_SLUGS.has(slug)) at(`"${slug}" is reserved by Glance and cannot be a page slug.`);
  const clash = allPages.find((p) => p.id !== page.id && (p.slug?.trim() || slugify(p.name)) === slug);
  if (clash) at(`Slug "${slug}" is already used by another page.`);

  for (const { widget } of walkWidgets(page)) {
    const missing = missingRequiredFields(widget);
    if (missing.length > 0) {
      issues.push({
        pageId: page.id,
        widgetId: widget.id,
        message: `${label(widget)} is missing ${missing.join(', ')}.`,
      });
    }
    const cache = widget.props['cache'];
    if (typeof cache === 'string' && cache.trim() !== '' && !DURATION_PATTERN.test(cache.trim())) {
      issues.push({
        pageId: page.id,
        widgetId: widget.id,
        message: `${label(widget)} has an invalid cache duration "${cache}". Use a single unit, e.g. 30s, 5m, 12h, 1d.`,
      });
    }
  }

  return issues;
}

function label(widget: WidgetInstance): string {
  return WIDGETS_BY_TYPE.get(widget.type)?.label ?? widget.type;
}

/** Bounds from `hslColorField` and the multiplier fields in themeProperties. */
export function themeIssues(theme: ThemeConfig | undefined): Issue[] {
  if (isThemeEmpty(theme)) return [];
  const issues: Issue[] = [];

  const colors: Array<[string, HSL | undefined]> = [
    ['background-color', theme!.backgroundColor],
    ['primary-color', theme!.primaryColor],
    ['positive-color', theme!.positiveColor],
    ['negative-color', theme!.negativeColor],
  ];
  for (const [name, color] of colors) {
    if (color && !isValidHsl(color)) {
      issues.push({ message: `Theme ${name} is out of range (hue 0-360, saturation and lightness 0-100).` });
    }
  }

  for (const [name, value] of [
    ['contrast-multiplier', theme!.contrastMultiplier],
    ['text-saturation-multiplier', theme!.textSaturationMultiplier],
  ] as Array<[string, number | undefined]>) {
    if (value !== undefined && (!Number.isFinite(value) || value <= 0)) {
      issues.push({ message: `Theme ${name} must be a positive number.` });
    }
  }

  return issues;
}

export function configIssues(config: Config): Issue[] {
  if (config.pages.length === 0) return [{ message: 'Add at least one page.' }];
  return [...themeIssues(config.theme), ...config.pages.flatMap((page) => pageIssues(page, config.pages))];
}
