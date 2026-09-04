/**
 * Builds a config that uses every widget type in the catalog, with required
 * fields filled in, and writes it out. Used to check the catalog against the
 * real Glance parser via `glance --config <file> config:validate`.
 */
import { writeFileSync } from 'node:fs';
import type { Config, Page, WidgetInstance } from '../model/types';
import type { FieldDef } from '../catalog/types';
import { WIDGETS } from '../catalog/widgets';
import { newColumn, newPage, newWidget } from '../model/reducer';
import { toYaml } from '../export/toYaml';

function sample(field: FieldDef): unknown {
  switch (field.kind) {
    case 'url':
      return 'https://example.com/feed.xml';
    case 'secret':
      return '${SOME_TOKEN}';
    case 'text':
      return 'hello';
    case 'number':
      return field.default ?? 1;
    case 'boolean':
      return true;
    case 'enum':
      return field.options[0];
    case 'stringList':
      return ['example-one', 'example-two'];
    case 'objectList':
      return [Object.fromEntries(field.fields.map((f) => [f.key, sample(f)]))];
    case 'string':
      return field.key === 'repository' ? 'glanceapp/glance' : 'example';
  }
}

function build(type: string): WidgetInstance {
  const widget = newWidget(type);
  const def = WIDGETS.find((w) => w.type === type)!;
  for (const field of def.fields) {
    if (field.required) widget.props[field.key] = sample(field);
  }
  if (def.container) widget.children = [buildLeaf()];
  return widget;
}

function buildLeaf(): WidgetInstance {
  const widget = newWidget('hacker-news');
  return widget;
}

// Three widgets per column, one full column per page, at most 3 columns.
const pages: Page[] = [];
let page: Page | null = null;
let columnIndex = 0;

for (const def of WIDGETS) {
  if (!page || columnIndex >= 3) {
    page = { ...newPage(`Page ${pages.length + 1}`), columns: [newColumn('full'), newColumn('small')] };
    pages.push(page);
    columnIndex = 0;
  }
  const column = page.columns[columnIndex % page.columns.length]!;
  column.widgets.push(build(def.type));
  if (column.widgets.length >= 3) columnIndex += 1;
}

const config: Config = { pages };
writeFileSync(process.argv[2]!, toYaml(config));
console.log(`${WIDGETS.length} widget types across ${pages.length} pages`);
