import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { importWidgetYaml } from '../model/importWidget';
import { toPlainObject } from '../export/toYaml';
import type { Config } from '../model/types';

/**
 * Verbatim from the Lemmy community widget's README — the shape these snippets
 * actually arrive in, complete with `${ENV}` placeholders, a headers map and a
 * multi-line Go template.
 */
const LEMMY = `- type: custom-api
  title: L/\${LEMMY_COMMUNITY}
  cache: 10m
  url: https://lemmy.world/api/v3/post/list?community_name=\${LEMMY_COMMUNITY}&limit=\${LEMMY_POST_LIMIT}
  options:
    COLLAPSE_AFTER_COUNT: 5
  headers:
    Accept: application/json
  template: |
    {{ $collapse_after_count := .Options.IntOr "COLLAPSE_AFTER_COUNT" 5 }}
    <ul class="list list-gap-14 collapsible-container">
    {{ range.JSON.Array "posts" }}
      <li>{{ .String "post.name" }}</li>
    {{ end }}
    </ul>
`;

/** Wraps widgets in a one-page config so the emitter can be run over them. */
function configOf(widgets: ReturnType<typeof importWidgetYaml>): Config {
  if (!widgets.ok) throw new Error(widgets.errors.join('; '));
  return {
    pages: [{ id: 'p', name: 'Home', columns: [{ id: 'c', size: 'full', widgets: widgets.widgets }] }],
  };
}

describe('accepting real snippets', () => {
  it('imports a community custom-api widget', () => {
    const result = importWidgetYaml(LEMMY);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.widgets).toHaveLength(1);
    const widget = result.widgets[0]!;
    expect(widget.type).toBe('custom-api');
    expect(widget.props['headers']).toEqual({ Accept: 'application/json' });
    expect(widget.props['options']).toEqual({ COLLAPSE_AFTER_COUNT: 5 });
    expect(String(widget.props['template'])).toContain('range.JSON.Array');
  });

  it('round-trips every property back out through the emitter', () => {
    const emitted = toPlainObject(configOf(importWidgetYaml(LEMMY)));
    const page = (emitted['pages'] as Record<string, unknown>[])[0]!;
    const column = (page['columns'] as Record<string, unknown>[])[0]!;
    const widget = (column['widgets'] as Record<string, unknown>[])[0]!;

    const original = (parse(LEMMY) as Record<string, unknown>[])[0]!;
    for (const key of Object.keys(original)) {
      expect(widget[key]).toEqual(original[key]);
    }
  });

  it('leaves ${ENV} placeholders untouched — Glance substitutes them itself', () => {
    const result = importWidgetYaml(LEMMY);
    if (!result.ok) throw new Error('expected success');
    expect(result.widgets[0]!.props['title']).toBe('L/${LEMMY_COMMUNITY}');
    expect(String(result.widgets[0]!.props['url'])).toContain('${LEMMY_POST_LIMIT}');
  });

  it('accepts a single widget that is not wrapped in a list', () => {
    const result = importWidgetYaml('type: clock\nhour-format: 12h\n');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.widgets[0]!.props['hour-format']).toBe('12h');
  });

  it('accepts a fragment still wrapped in its `widgets:` key', () => {
    const result = importWidgetYaml('widgets:\n  - type: clock\n  - type: calendar\n');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.widgets.map((w) => w.type)).toEqual(['clock', 'calendar']);
  });

  it('imports a container with its children', () => {
    const result = importWidgetYaml(
      '- type: group\n  widgets:\n    - type: hacker-news\n    - type: lobsters\n',
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.widgets[0]!.children?.map((c) => c.type)).toEqual(['hacker-news', 'lobsters']);
  });

  it('gives every imported widget a distinct id', () => {
    const result = importWidgetYaml('- type: clock\n- type: clock\n');
    if (!result.ok) throw new Error('expected success');
    expect(result.widgets[0]!.id).not.toBe(result.widgets[1]!.id);
  });
});

describe('refusing what Glance would refuse', () => {
  it('rejects a type this build does not have', () => {
    const result = importWidgetYaml('- type: weather-forecast-pro\n  location: London\n');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toContain('unknown widget type');
    expect(result.errors[0]).toContain('weather-forecast-pro');
  });

  it('rejects a container nested inside a container', () => {
    const result = importWidgetYaml(
      '- type: group\n  widgets:\n    - type: split-column\n      widgets: []\n',
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toContain('container');
  });

  it('rejects a widget with no type', () => {
    const result = importWidgetYaml('- title: Just a title\n');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toContain('`type`');
  });

  it('imports nothing at all when one widget in the batch is bad', () => {
    const result = importWidgetYaml('- type: clock\n- type: nonsense\n');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toHaveLength(1);
  });

  it('reports malformed YAML rather than throwing', () => {
    const result = importWidgetYaml('- type: clock\n   bad indent: [1,\n');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toContain('YAML');
  });

  it('rejects an empty paste', () => {
    expect(importWidgetYaml('   ').ok).toBe(false);
  });

  it('rejects a scalar', () => {
    expect(importWidgetYaml('just a string').ok).toBe(false);
  });
});
