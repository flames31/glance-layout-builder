import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { importConfigYaml } from '../model/importConfig';
import { toPlainObject, toYaml } from '../export/toYaml';
import { lookup, resolveCatalog, setActiveCatalog } from '../model/catalogSource';

const DOCS = readFileSync(new URL('./docs-glance.yml', import.meta.url), 'utf8');

type Config1 = {
  pages: { columns: { widgets?: Record<string, unknown>[] }[] }[];
};

/** Asserts every value in `actual` matches `expected`, ignoring absent keys. */
function expectSubset(actual: unknown, expected: unknown, path = ''): void {
  if (Array.isArray(actual)) {
    expect(Array.isArray(expected), `${path} should be a list`).toBe(true);
    actual.forEach((item, i) => expectSubset(item, (expected as unknown[])[i], `${path}[${i}]`));
    return;
  }
  if (actual !== null && typeof actual === 'object') {
    for (const [key, value] of Object.entries(actual)) {
      expectSubset(value, (expected as Record<string, unknown>)?.[key], `${path}.${key}`);
    }
    return;
  }
  expect(actual, `value at ${path}`).toEqual(expected);
}

afterEach(() => setActiveCatalog(resolveCatalog(null)));

function ok(text: string) {
  const result = importConfigYaml(text);
  if (!result.ok) throw new Error(result.errors.join('; '));
  return result;
}

describe("Glance's own starter config", () => {
  it('imports every page, column and widget', () => {
    const { config } = ok(DOCS);
    const original = parse(DOCS) as { pages: { columns: { widgets?: unknown[] }[] }[] };

    expect(config.pages).toHaveLength(original.pages.length);
    config.pages.forEach((page, i) => {
      expect(page.columns).toHaveLength(original.pages[i]!.columns.length);
      page.columns.forEach((column, j) => {
        expect(column.widgets).toHaveLength(original.pages[i]!.columns[j]!.widgets?.length ?? 0);
      });
    });
  });

  it('changes no value it keeps', () => {
    // The emitter prunes properties whose value equals the default Glance would
    // apply anyway, so the output is a subset of the input rather than a copy.
    // Nothing it does keep may differ.
    const emitted = toPlainObject(ok(DOCS).config);
    expectSubset(emitted, parse(DOCS));
  });

  it('drops a property only when it equals the default Glance would apply', () => {
    const emitted = toPlainObject(ok(DOCS).config) as Config1;
    const original = parse(DOCS) as Config1;

    const dropped: string[] = [];
    original.pages.forEach((page, i) =>
      page.columns.forEach((column, j) =>
        (column.widgets ?? []).forEach((widget, k) => {
          const kept = emitted.pages[i]!.columns[j]!.widgets![k]!;
          for (const [key, value] of Object.entries(widget)) {
            if (key in kept) continue;
            dropped.push(`${String(widget['type'])}.${key}`);
            // The only licence the emitter has to omit something.
            const field = lookup(String(widget['type']))?.fields.find((f) => f.key === key);
            expect(field, `${String(widget['type'])}.${key} has no catalog field`).toBeDefined();
            expect(
              'default' in field! ? field.default : undefined,
              `${String(widget['type'])}.${key} was dropped but is not the default`,
            ).toEqual(value);
          }
        }),
      ),
    );

    // The starter config does state a few of Glance's own defaults explicitly.
    expect(dropped.length).toBeGreaterThan(0);
  });

  it('is stable when re-imported', () => {
    const once = toYaml(ok(DOCS).config);
    const twice = toYaml(ok(once).config);
    expect(twice).toBe(once);
  });

  it('reports nothing alarming about a config it fully understands', () => {
    expect(ok(DOCS).warnings).toEqual([]);
  });
});

describe('structure', () => {
  it('reads column sizes', () => {
    const { config } = ok(
      'pages:\n  - name: Home\n    columns:\n      - size: small\n        widgets: []\n      - size: full\n        widgets: []\n',
    );
    expect(config.pages[0]!.columns.map((c) => c.size)).toEqual(['small', 'full']);
  });

  it('nests container children', () => {
    const { config } = ok(
      'pages:\n  - name: Home\n    columns:\n      - size: full\n        widgets:\n          - type: group\n            widgets:\n              - type: hacker-news\n              - type: lobsters\n',
    );
    const group = config.pages[0]!.columns[0]!.widgets[0]!;
    expect(group.children?.map((c) => c.type)).toEqual(['hacker-news', 'lobsters']);
  });

  it('keeps a slug only when it differs from the derived one', () => {
    const derived = ok('pages:\n  - name: My Page\n    slug: my-page\n    columns:\n      - size: full\n        widgets: []\n');
    expect(derived.config.pages[0]!.slug).toBeUndefined();

    const custom = ok('pages:\n  - name: My Page\n    slug: elsewhere\n    columns:\n      - size: full\n        widgets: []\n');
    expect(custom.config.pages[0]!.slug).toBe('elsewhere');
  });

  it('reads page flags and width', () => {
    const { config } = ok(
      'pages:\n  - name: Home\n    width: slim\n    center-vertically: true\n    hide-desktop-navigation: true\n    columns:\n      - size: full\n        widgets: []\n',
    );
    expect(config.pages[0]).toMatchObject({
      width: 'slim',
      centerVertically: true,
      hideDesktopNavigation: true,
    });
  });

  it('gives every imported page, column and widget a distinct id', () => {
    const { config } = ok(DOCS);
    const ids = new Set<string>();
    let total = 0;
    for (const page of config.pages) {
      ids.add(page.id);
      total += 1;
      for (const column of page.columns) {
        ids.add(column.id);
        total += 1;
        const walk = (widgets: typeof column.widgets) => {
          for (const w of widgets) {
            ids.add(w.id);
            total += 1;
            if (w.children) walk(w.children);
          }
        };
        walk(column.widgets);
      }
    }
    expect(ids.size).toBe(total);
  });
});

describe('theme', () => {
  it('reads an HSL triple, with or without percent signs', () => {
    const { config } = ok(
      'theme:\n  background-color: 240 8 9\n  primary-color: 43 50% 70%\n  light: true\n  contrast-multiplier: 1.2\npages:\n  - name: Home\n    columns:\n      - size: full\n        widgets: []\n',
    );
    expect(config.theme).toEqual({
      backgroundColor: { h: 240, s: 8, l: 9 },
      primaryColor: { h: 43, s: 50, l: 70 },
      light: true,
      contrastMultiplier: 1.2,
    });
  });

  it('warns about a colour it cannot read rather than failing', () => {
    const result = ok(
      'theme:\n  background-color: rebeccapurple\npages:\n  - name: Home\n    columns:\n      - size: full\n        widgets: []\n',
    );
    expect(result.config.theme).toBeUndefined();
    expect(result.warnings.join(' ')).toContain('background-color');
  });
});

describe('leniency where Glance is already running the config', () => {
  it('imports an unrecognised widget type and keeps its properties', () => {
    const result = ok(
      'pages:\n  - name: Home\n    columns:\n      - size: full\n        widgets:\n          - type: solar-inverter\n            endpoint: http://inverter.local\n',
    );
    const widget = result.config.pages[0]!.columns[0]!.widgets[0]!;
    expect(widget.type).toBe('solar-inverter');
    expect(widget.props['endpoint']).toBe('http://inverter.local');
    expect(result.warnings.join(' ')).toContain('solar-inverter');
  });

  it('exports an unrecognised widget unchanged', () => {
    const yaml =
      'pages:\n  - name: Home\n    columns:\n      - size: full\n        widgets:\n          - type: solar-inverter\n            endpoint: http://inverter.local\n            poll: 30\n';
    expect(toPlainObject(ok(yaml).config)).toEqual(parse(yaml));
  });

  it('flags a type the uploaded catalog says the build lacks', () => {
    setActiveCatalog(
      resolveCatalog({
        schema: 'glance-layout-builder/catalog@1',
        generatedAt: '',
        source: { path: '/glance', commit: null },
        widgets: [{ type: 'clock', aliases: [], container: false, keys: [] }],
      }),
    );
    const result = ok(
      'pages:\n  - name: Home\n    columns:\n      - size: full\n        widgets:\n          - type: rss\n',
    );
    expect(result.warnings.join(' ')).toContain('rss');
  });

  it('warns about sections it cannot edit instead of dropping them silently', () => {
    const result = ok(
      'server:\n  port: 8080\nauth:\n  secret-key: x\npages:\n  - name: Home\n    columns:\n      - size: full\n        widgets: []\n',
    );
    expect(result.warnings.join(' ')).toContain('server');
    expect(result.warnings.join(' ')).toContain('auth');
  });

  it('defaults a missing column size rather than refusing the file', () => {
    const result = ok('pages:\n  - name: Home\n    columns:\n      - widgets: []\n');
    expect(result.config.pages[0]!.columns[0]!.size).toBe('full');
    expect(result.warnings.join(' ')).toContain('full');
  });
});

describe('refusing what is not a config', () => {
  it.each([
    ['', 'paste a config'],
    ['   ', 'paste a config'],
    ['just a string', '`pages:`'],
    ['pages: []', '`pages:`'],
    ['widgets:\n  - type: clock', '`pages:`'],
  ])('rejects %o', (input, expected) => {
    const result = importConfigYaml(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toContain(expected);
  });

  it('rejects a page with no columns', () => {
    const result = importConfigYaml('pages:\n  - name: Home\n');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toContain('no columns');
  });

  it('reports malformed YAML rather than throwing', () => {
    const result = importConfigYaml('pages:\n  - name: [unclosed\n');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toContain('YAML');
  });
});
