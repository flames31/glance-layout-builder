/**
 * Resolves the widget menu from the built-in catalog plus, optionally, a
 * catalog generated from the user's own Glance checkout.
 *
 * The built-in catalog is hand-written and knows things no amount of source
 * parsing can recover — labels, help text, defaults, which values an enum
 * accepts. A generated catalog knows something the built-in one cannot: which
 * widgets and properties *this* build actually has. So the two are merged
 * rather than swapped, and each supplies what it is better at.
 *
 * The merge runs in both directions. A type only the upload knows about becomes
 * a new palette entry; a type only the built-in catalog knows about is marked
 * unavailable, because placing it would produce a config the user's Glance
 * rejects with `unknown widget type`.
 */

import type { FieldDef, WidgetCategory, WidgetDef } from '../catalog/types';
import { SHARED_FIELDS } from '../catalog/types';
import { WIDGETS } from '../catalog/widgets';

export const CATALOG_SCHEMA = 'glance-layout-builder/catalog@1';

export type CatalogKey = {
  key: string;
  goType: string;
  kind: FieldDef['kind'];
  fields?: CatalogKey[];
};

export type CatalogWidget = {
  type: string;
  aliases: string[];
  container: boolean;
  keys: CatalogKey[];
};

export type UploadedCatalog = {
  schema: string;
  generatedAt: string;
  source: { path: string; commit: string | null };
  widgets: CatalogWidget[];
};

/** A widget definition plus what the uploaded catalog says about it. */
export type ResolvedWidget = WidgetDef & {
  /** Keys this build accepts that the curated definition has no field for. */
  extraFields: FieldDef[];
  /** False when the uploaded catalog shows this build has no such widget. */
  available: boolean;
  /** True when the definition was synthesised from the upload. */
  generated: boolean;
};

export type ResolvedCatalog = {
  widgets: ResolvedWidget[];
  byType: ReadonlyMap<string, ResolvedWidget>;
  source: { label: string; commit: string | null } | null;
};

// ------------------------------------------------------------------ helpers

/** `process-stats` → `Process Stats`. */
function humanize(type: string): string {
  return type
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

const SHARED_KEYS = new Set(SHARED_FIELDS.map((f) => f.key));

/**
 * Turns an extracted key into a form field. Without labels or defaults in the
 * source, the key itself is the best label available.
 */
function toField(key: CatalogKey): FieldDef {
  const label = humanize(key.key);
  switch (key.kind) {
    case 'number':
      return { kind: 'number', key: key.key, label };
    case 'boolean':
      return { kind: 'boolean', key: key.key, label };
    case 'stringList':
      return { kind: 'stringList', key: key.key, label };
    case 'objectList':
      return {
        kind: 'objectList',
        key: key.key,
        label,
        summaryKey: key.fields?.[0]?.key ?? 'name',
        fields: (key.fields ?? []).map(toField),
      };
    case 'keyValue':
      return { kind: 'keyValue', key: key.key, label, help: `Go type: ${key.goType}` };
    case 'raw':
      return { kind: 'raw', key: key.key, label, help: `Go type: ${key.goType}` };
    default:
      return { kind: 'string', key: key.key, label };
  }
}

/** Collects every key a `FieldDef` list already covers, including shared ones. */
function coveredKeys(def: WidgetDef): Set<string> {
  const keys = new Set<string>(SHARED_KEYS);
  for (const field of def.fields) keys.add(field.key);
  return keys;
}

// -------------------------------------------------------------- validation

export function parseCatalogFile(text: string): { ok: true; catalog: UploadedCatalog } | { ok: false; errors: string[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return { ok: false, errors: [`Not valid JSON — ${error instanceof Error ? error.message : String(error)}`] };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, errors: ['Expected a catalog object.'] };
  }
  const candidate = parsed as Partial<UploadedCatalog>;

  if (candidate.schema !== CATALOG_SCHEMA) {
    return {
      ok: false,
      errors: [
        `Unexpected schema \`${String(candidate.schema)}\`. Regenerate with: npm run catalog -- <path-to-glance>`,
      ],
    };
  }
  if (!Array.isArray(candidate.widgets) || candidate.widgets.length === 0) {
    return { ok: false, errors: ['The catalog lists no widgets.'] };
  }
  for (const widget of candidate.widgets) {
    if (typeof widget?.type !== 'string' || !Array.isArray(widget?.keys)) {
      return { ok: false, errors: ['A widget entry is malformed — expected `type` and `keys`.'] };
    }
  }

  return { ok: true, catalog: candidate as UploadedCatalog };
}

// ------------------------------------------------------------------- merge

export function resolveCatalog(uploaded: UploadedCatalog | null): ResolvedCatalog {
  if (!uploaded) {
    const widgets = WIDGETS.map((def) => ({
      ...def,
      extraFields: [],
      available: true,
      generated: false,
    }));
    return { widgets, byType: new Map(widgets.map((w) => [w.type, w])), source: null };
  }

  const fromUpload = new Map<string, CatalogWidget>();
  for (const widget of uploaded.widgets) fromUpload.set(widget.type, widget);

  const widgets: ResolvedWidget[] = WIDGETS.map((def) => {
    const match = fromUpload.get(def.type);
    if (!match) {
      // Their Glance has no such widget; keep it visible but refuse to place it.
      return { ...def, extraFields: [], available: false, generated: false };
    }

    const covered = coveredKeys(def);
    const extraFields = match.keys.filter((k) => !covered.has(k.key)).map(toField);
    return { ...def, extraFields, available: true, generated: false };
  });

  // Whatever their build has that the curated catalog has never heard of.
  const known = new Set(WIDGETS.map((w) => w.type));
  for (const widget of uploaded.widgets) {
    if (known.has(widget.type)) continue;
    widgets.push({
      type: widget.type,
      label: humanize(widget.type),
      category: 'Imported' as WidgetCategory,
      description: `From your Glance build. Fields are derived from the source, so they have no descriptions.`,
      container: widget.container,
      fields: widget.keys.filter((k) => !SHARED_KEYS.has(k.key)).map(toField),
      extraFields: [],
      available: true,
      generated: true,
    });
  }

  const label = uploaded.source.path.split('/').filter(Boolean).pop() ?? 'your Glance';
  return {
    widgets,
    byType: new Map(widgets.map((w) => [w.type, w])),
    source: { label, commit: uploaded.source.commit },
  };
}

// ------------------------------------------------------------ active catalog

/**
 * The catalog the rest of the app resolves types against.
 *
 * Module-level rather than threaded through every signature, because it is
 * exactly what `WIDGETS_BY_TYPE` already was — one process-wide answer to "what
 * widgets exist" — and the emitter, validator and reducer all need it without
 * caring where it came from. It defaults to the built-in catalog, so anything
 * that never uploads (every test included) behaves as before.
 */
let active: ResolvedCatalog = resolveCatalog(null);

export function setActiveCatalog(catalog: ResolvedCatalog): void {
  active = catalog;
}

export function activeCatalog(): ResolvedCatalog {
  return active;
}

/** The definition for a widget type, or undefined if this build has no such type. */
export function lookup(type: string): ResolvedWidget | undefined {
  return active.byType.get(type);
}
