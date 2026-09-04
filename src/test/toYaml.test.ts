import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { toYaml } from '../export/toYaml';
import { WIDGETS_BY_TYPE } from '../catalog/widgets';
import { docsFixture } from './fixture';

type Doc = { pages: Array<{ name: string; columns: Array<{ size: string; widgets: Widget[] }> }> };
type Widget = Record<string, unknown> & { type: string; widgets?: Widget[] };

const goldenPath = fileURLToPath(new URL('./docs-glance.yml', import.meta.url));
const golden = parse(readFileSync(goldenPath, 'utf8')) as Doc;
const emitted = parse(toYaml(docsFixture)) as Doc;

/** Flattens a page's widgets depth-first, so nesting differences show up too. */
function flatten(widgets: Widget[], path: string): Array<{ path: string; widget: Widget }> {
  return widgets.flatMap((widget, i) => {
    const here = `${path}[${i}]:${widget.type}`;
    return [{ path: here, widget }, ...flatten(widget.widgets ?? [], here)];
  });
}

function allWidgets(doc: Doc) {
  return doc.pages.flatMap((page, p) =>
    page.columns.flatMap((column, c) => flatten(column.widgets, `page${p}.col${c}`)),
  );
}

/** The catalog default for a key, or undefined if the field has none. */
function catalogDefault(type: string, key: string): unknown {
  const field = WIDGETS_BY_TYPE.get(type)?.fields.find((f) => f.key === key);
  if (!field) return undefined;
  if (field.kind === 'number' || field.kind === 'enum') return field.default;
  if (field.kind === 'boolean') return field.default ?? false;
  return undefined;
}

describe('toYaml against the docs/glance.yml starter config', () => {
  it('produces parseable YAML', () => {
    expect(emitted).toBeTypeOf('object');
    expect(emitted.pages).toHaveLength(golden.pages.length);
  });

  it('reproduces the page, column and widget structure exactly', () => {
    const shape = (doc: Doc) =>
      doc.pages.map((page) => ({
        name: page.name,
        columns: page.columns.map((column) => ({
          size: column.size,
          widgets: allWidgets({ pages: [{ name: page.name, columns: [column] }] }).map((x) => x.path),
        })),
      }));

    expect(shape(emitted)).toEqual(shape(golden));
  });

  it('reproduces every value from the golden config, omitting only catalog defaults', () => {
    const goldenWidgets = allWidgets(golden);
    const emittedWidgets = new Map(allWidgets(emitted).map((x) => [x.path, x.widget]));

    for (const { path, widget } of goldenWidgets) {
      const ours = emittedWidgets.get(path);
      expect(ours, `missing widget at ${path}`).toBeDefined();

      for (const [key, value] of Object.entries(widget)) {
        if (key === 'widgets') continue;
        if (ours![key] === undefined) {
          // Legitimately dropped only when it matches the default Glance would apply anyway.
          expect(catalogDefault(widget.type, key), `${path}.${key} dropped but is not a default`).toEqual(value);
        } else {
          expect(ours![key], `${path}.${key}`).toEqual(value);
        }
      }
    }
  });

  it('never emits a key the golden config does not have', () => {
    const goldenWidgets = new Map(allWidgets(golden).map((x) => [x.path, x.widget]));
    for (const { path, widget } of allWidgets(emitted)) {
      const theirs = goldenWidgets.get(path)!;
      for (const key of Object.keys(widget)) {
        if (key === 'widgets') continue;
        expect(theirs, `${path}.${key} is extra`).toHaveProperty(key);
      }
    }
  });
});
