/**
 * Builds a widget catalog from a Glance checkout.
 *
 * Glance has no endpoint that reports which widgets it supports — the type set
 * is a closed switch in `internal/glance/widget.go`, and every widget's config
 * shape lives in the `yaml:` struct tags of its `widget-*.go` file. Reading them
 * is therefore the only way to learn what a given build actually accepts, which
 * matters because forks add types (`ical`, `process-stats`) that upstream lacks
 * and upstream adds types over time.
 *
 * The output is uploaded into the builder, where it augments the hand-written
 * catalog: unknown types become new palette entries, extra keys become extra
 * fields, and built-in types the file does not mention are marked unavailable.
 *
 * Usage:  npm run catalog -- ../GoProjects/glance [-o glance-catalog.json]
 *
 * Text-level parsing rather than a Go AST: the tags are uniform across every
 * widget file, and this keeps the tool a dependency-free script that anyone can
 * run against their own checkout without a Go toolchain.
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

export const SCHEMA = 'glance-layout-builder/catalog@1';

export type FieldKind =
  | 'string'
  | 'number'
  | 'boolean'
  | 'stringList'
  | 'objectList'
  | 'keyValue'
  | 'raw';

export type CatalogKey = {
  key: string;
  goType: string;
  kind: FieldKind;
  /** Present for `objectList`: the shape of one row. */
  fields?: CatalogKey[];
};

export type CatalogWidget = {
  type: string;
  /** Other `type:` values Glance accepts for this same widget, e.g. `stocks`. */
  aliases: string[];
  container: boolean;
  keys: CatalogKey[];
};

export type Catalog = {
  schema: typeof SCHEMA;
  generatedAt: string;
  source: { path: string; commit: string | null };
  widgets: CatalogWidget[];
};

// ------------------------------------------------------------------ parsing

/** `type foo struct { ... }` bodies, keyed by type name. */
export function parseStructs(source: string): Map<string, string> {
  const structs = new Map<string, string>();
  // Non-greedy to the first line that closes the block at column zero.
  const pattern = /type\s+(\w+)\s+struct\s*\{\n([\s\S]*?)\n\}/g;
  for (const match of source.matchAll(pattern)) {
    structs.set(match[1]!, match[2]!);
  }
  return structs;
}

/**
 * The `type` → struct mapping from `newWidget`'s switch. A single case can
 * carry several labels (`case "markets", "stocks":`); the first is treated as
 * canonical and the rest as aliases, matching how the docs present them.
 */
export function parseTypeSwitch(source: string): { type: string; aliases: string[]; struct: string }[] {
  const fn = source.match(/func newWidget\(widgetType string\)[\s\S]*?\n\}\n/);
  if (!fn) return [];

  const out: { type: string; aliases: string[]; struct: string }[] = [];
  const pattern = /case\s+((?:"[^"]+"\s*,?\s*)+):\s*\n\s*w\s*=\s*&(\w+)\{\}/g;
  for (const match of fn[0].matchAll(pattern)) {
    const labels = [...match[1]!.matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
    const [canonical, ...aliases] = labels;
    if (canonical) out.push({ type: canonical, aliases, struct: match[2]! });
  }
  return out;
}

/** Maps a Go type to the closest thing the builder can render as a form field. */
export function kindOf(goType: string, structs: Map<string, string>): FieldKind {
  const type = goType.replace(/^\*/, '').trim();
  if (type === 'string') return 'string';
  if (type === 'bool') return 'boolean';
  if (/^(u?int(8|16|32|64)?|float(32|64))$/.test(type)) return 'number';
  if (type === '[]string') return 'stringList';
  if (type === 'map[string]string') return 'keyValue';
  if (type.startsWith('[]') && structs.has(type.slice(2).replace(/^\*/, ''))) return 'objectList';
  // durationField, hslColorField and friends are strings once parsed.
  if (/Field$/.test(type)) return 'string';
  return 'raw';
}

/**
 * Every YAML key a struct accepts. Embedded types tagged `yaml:",inline"`
 * contribute their own keys — this is how `widgetBase` gives every widget
 * `title`, `cache`, `title-url`, `hide-header` and `css-class`.
 */
export function keysOf(
  structName: string,
  structs: Map<string, string>,
  seen: Set<string> = new Set(),
): CatalogKey[] {
  const body = structs.get(structName.replace(/^\*/, ''));
  if (body === undefined || seen.has(structName)) return [];
  seen.add(structName);

  const keys: CatalogKey[] = [];
  for (const line of body.split('\n')) {
    const tag = line.match(/`[^`]*yaml:"([^"]*)"/);
    if (!tag) continue;

    const spec = tag[1]!;
    if (spec === '-') continue; // runtime-only field, never read from config

    const declaration = line.split('`')[0]!.trim();

    if (spec.split(',').includes('inline')) {
      const embedded = declaration.match(/^\*?(\w+)$/);
      if (embedded) keys.push(...keysOf(embedded[1]!, structs, seen));
      continue;
    }

    const key = spec.split(',')[0]!;
    if (key === '') continue;

    // `Name  []someType` — the type is whatever follows the field name.
    const goType = declaration.replace(/^\S+\s+/, '').trim();
    const kind = kindOf(goType, structs);

    const entry: CatalogKey = { key, goType, kind };
    if (kind === 'objectList') {
      entry.fields = keysOf(goType.slice(2), structs, new Set(seen));
    }
    keys.push(entry);
  }
  return keys;
}

export function buildCatalog(sources: string[], sourcePath: string, commit: string | null): Catalog {
  const blob = sources.join('\n');
  const structs = parseStructs(blob);
  const cases = parseTypeSwitch(blob);

  if (cases.length === 0) {
    throw new Error(
      'Could not find the newWidget switch in internal/glance/widget.go — is this a Glance checkout?',
    );
  }

  const widgets: CatalogWidget[] = cases.map(({ type, aliases, struct }) => {
    const keys = keysOf(struct, structs);
    if (keys.length === 0) {
      throw new Error(`Could not resolve the config shape of \`${type}\` (struct ${struct}).`);
    }
    return {
      type,
      aliases,
      // Glance's containers are exactly the widgets that hold a widget list.
      container: keys.some((k) => k.key === 'widgets'),
      keys: keys.filter((k) => k.key !== 'type' && k.key !== 'widgets'),
    };
  });

  return {
    schema: SCHEMA,
    generatedAt: new Date().toISOString(),
    source: { path: sourcePath, commit },
    widgets: widgets.sort((a, b) => a.type.localeCompare(b.type)),
  };
}

// ---------------------------------------------------------------------- cli

function readGoSources(root: string): string[] {
  const dir = join(root, 'internal', 'glance');
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    throw new Error(`No internal/glance directory under ${root} — point this at a Glance checkout.`);
  }
  return entries.filter((f) => f.endsWith('.go')).map((f) => readFileSync(join(dir, f), 'utf8'));
}

function gitCommit(root: string): string | null {
  try {
    return execFileSync('git', ['-C', root, 'rev-parse', '--short', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

function main(argv: string[]): void {
  const args = argv.filter((a) => a !== '--');
  const outFlag = args.indexOf('-o');
  const out = outFlag === -1 ? 'glance-catalog.json' : args[outFlag + 1]!;
  const root = args.find((a, i) => !a.startsWith('-') && i !== outFlag + 1);

  if (!root) {
    console.error('Usage: npm run catalog -- <path-to-glance-checkout> [-o out.json]');
    process.exit(1);
  }

  const catalog = buildCatalog(readGoSources(root), root, gitCommit(root));
  writeFileSync(out, JSON.stringify(catalog, null, 2) + '\n');

  const keyCount = catalog.widgets.reduce((n, w) => n + w.keys.length, 0);
  const aliases = catalog.widgets.flatMap((w) => w.aliases);
  console.log(`  reading ${join(root, 'internal/glance')}`);
  console.log(`  ✓ ${catalog.widgets.length} widget types${catalog.source.commit ? ` @ ${catalog.source.commit}` : ''}`);
  console.log(`  ✓ ${keyCount} config keys`);
  if (aliases.length > 0) console.log(`  ✓ ${aliases.length} alias(es): ${aliases.join(', ')}`);
  console.log(`\n  wrote ${out}\n\n  Upload it in the builder to update the widget menu.`);
}

// Only run the CLI when executed directly, so tests can import the parsers.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop()!)) {
  main(process.argv.slice(2));
}
