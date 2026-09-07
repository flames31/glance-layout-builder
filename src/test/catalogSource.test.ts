import { afterEach, describe, expect, it } from 'vitest';
import type { UploadedCatalog } from '../model/catalogSource';
import {
  CATALOG_SCHEMA,
  parseCatalogFile,
  resolveCatalog,
  setActiveCatalog,
} from '../model/catalogSource';
import { WIDGETS } from '../catalog/widgets';
import { importWidgetYaml } from '../model/importWidget';

function catalogOf(widgets: UploadedCatalog['widgets']): UploadedCatalog {
  return {
    schema: CATALOG_SCHEMA,
    generatedAt: '2026-09-05T00:00:00.000Z',
    source: { path: '/home/me/glance', commit: 'ce78d59' },
    widgets,
  };
}

const clock = { type: 'clock', aliases: [], container: false, keys: [{ key: 'hour-format', goType: 'string', kind: 'string' as const }] };

// The module registry is global; every test that swaps it must put it back.
afterEach(() => setActiveCatalog(resolveCatalog(null)));

describe('with no upload', () => {
  it('is exactly the built-in catalog, all available', () => {
    const resolved = resolveCatalog(null);
    expect(resolved.widgets).toHaveLength(WIDGETS.length);
    expect(resolved.widgets.every((w) => w.available)).toBe(true);
    expect(resolved.widgets.every((w) => !w.generated)).toBe(true);
    expect(resolved.source).toBeNull();
  });
});

describe('merging an upload', () => {
  it('keeps the curated definition rather than the generated one', () => {
    const resolved = resolveCatalog(
      catalogOf([{ ...clock, keys: [{ key: 'hour-format', goType: 'string', kind: 'string' }] }]),
    );
    const curated = WIDGETS.find((w) => w.type === 'clock')!;
    const merged = resolved.byType.get('clock')!;

    // The curated enum, with its options and default, survives.
    expect(merged.fields).toEqual(curated.fields);
    expect(merged.description).toBe(curated.description);
    expect(merged.generated).toBe(false);
  });

  it('surfaces keys the curated definition has no field for', () => {
    const resolved = resolveCatalog(
      catalogOf([
        {
          ...clock,
          keys: [
            { key: 'hour-format', goType: 'string', kind: 'string' },
            { key: 'css-class', goType: 'string', kind: 'string' },
            { key: 'title-url', goType: 'string', kind: 'string' },
          ],
        },
      ]),
    );
    expect(resolved.byType.get('clock')!.extraFields.map((f) => f.key)).toEqual([
      'css-class',
      'title-url',
    ]);
  });

  it('does not treat the shared title and cache fields as extra', () => {
    const resolved = resolveCatalog(
      catalogOf([
        {
          ...clock,
          keys: [
            { key: 'title', goType: 'string', kind: 'string' },
            { key: 'cache', goType: 'durationField', kind: 'string' },
          ],
        },
      ]),
    );
    expect(resolved.byType.get('clock')!.extraFields).toEqual([]);
  });

  it('adds a type the built-in catalog has never heard of', () => {
    const resolved = resolveCatalog(
      catalogOf([
        clock,
        {
          type: 'solar-inverter',
          aliases: [],
          container: false,
          keys: [{ key: 'refresh', goType: 'int', kind: 'number' }],
        },
      ]),
    );
    const added = resolved.byType.get('solar-inverter')!;
    expect(added.generated).toBe(true);
    expect(added.available).toBe(true);
    expect(added.label).toBe('Solar Inverter');
    expect(added.category).toBe('Imported');
    expect(added.fields.map((f) => f.key)).toEqual(['refresh']);
  });

  it('merges a fork type the built-in catalog already carries', () => {
    // `ical` and `process-stats` ship in the catalog but not in stock Glance,
    // so they must merge rather than be synthesised a second time.
    const resolved = resolveCatalog(
      catalogOf([{ type: 'process-stats', aliases: [], container: false, keys: [] }]),
    );
    const merged = resolved.byType.get('process-stats')!;
    expect(merged.generated).toBe(false);
    expect(merged.available).toBe(true);
    expect(resolved.widgets.filter((w) => w.type === 'process-stats')).toHaveLength(1);
  });

  it('marks a built-in type the upload does not have as unavailable', () => {
    const resolved = resolveCatalog(catalogOf([clock]));
    expect(resolved.byType.get('clock')!.available).toBe(true);
    expect(resolved.byType.get('rss')!.available).toBe(false);
    // Still listed, so the user can see why it is greyed out.
    expect(resolved.widgets.some((w) => w.type === 'rss')).toBe(true);
  });

  it('reports the source for the toolbar', () => {
    expect(resolveCatalog(catalogOf([clock])).source).toEqual({
      label: 'glance',
      commit: 'ce78d59',
    });
  });

  it('maps Go shapes onto renderable field kinds', () => {
    const resolved = resolveCatalog(
      catalogOf([
        {
          type: 'my-widget',
          aliases: [],
          container: false,
          keys: [
            { key: 'headers', goType: 'map[string]string', kind: 'keyValue' },
            { key: 'body', goType: 'any', kind: 'raw' },
            {
              key: 'sites',
              goType: '[]site',
              kind: 'objectList',
              fields: [{ key: 'url', goType: 'string', kind: 'string' }],
            },
          ],
        },
      ]),
    );
    const fields = resolved.byType.get('my-widget')!.fields;
    expect(fields.map((f) => f.kind)).toEqual(['keyValue', 'raw', 'objectList']);
    // An object list needs a summary key to label its collapsed rows.
    expect(fields[2]).toMatchObject({ summaryKey: 'url' });
  });
});

describe('the active catalog drives validation', () => {
  it('lets the importer accept a fork type once the upload declares it', () => {
    // Nothing in the built-in catalog, so a stock builder refuses it outright.
    const yaml = '- type: solar-inverter\n';
    expect(importWidgetYaml(yaml).ok).toBe(false);

    setActiveCatalog(
      resolveCatalog(
        catalogOf([clock, { type: 'solar-inverter', aliases: [], container: false, keys: [] }]),
      ),
    );
    expect(importWidgetYaml(yaml).ok).toBe(true);
  });

  it('makes the importer reject a type the upload says is absent', () => {
    expect(importWidgetYaml('- type: rss\n  feeds: []\n').ok).toBe(true);
    setActiveCatalog(resolveCatalog(catalogOf([clock])));
    expect(importWidgetYaml('- type: rss\n  feeds: []\n').ok).toBe(false);
  });
});

describe('parseCatalogFile', () => {
  it('accepts a well-formed catalog', () => {
    const result = parseCatalogFile(JSON.stringify(catalogOf([clock])));
    expect(result.ok).toBe(true);
  });

  it('rejects a file from a different schema version', () => {
    const result = parseCatalogFile(JSON.stringify({ ...catalogOf([clock]), schema: 'something@9' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toContain('npm run catalog');
  });

  it.each([
    ['not json at all', 'JSON'],
    ['null', 'catalog object'],
    ['[]', 'catalog object'],
  ])('rejects %s', (input, expected) => {
    const result = parseCatalogFile(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toContain(expected);
  });

  it('rejects a catalog with no widgets', () => {
    expect(parseCatalogFile(JSON.stringify(catalogOf([]))).ok).toBe(false);
  });

  it('rejects a malformed widget entry', () => {
    const bad = { ...catalogOf([clock]), widgets: [{ type: 'clock' }] };
    const result = parseCatalogFile(JSON.stringify(bad));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toContain('malformed');
  });
});
