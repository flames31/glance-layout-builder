import { describe, expect, it } from 'vitest';
import { instantiate, makeSaved, parseSaved, suggestName } from '../model/savedWidgets';
import { importWidgetYaml } from '../model/importWidget';
import type { WidgetInstance } from '../model/types';

const widget = (props: Record<string, unknown> = {}, children?: WidgetInstance[]): WidgetInstance => ({
  id: 'w1',
  type: 'custom-api',
  props,
  ...(children ? { children } : {}),
});

describe('suggestName', () => {
  it('prefers the widget title', () => {
    expect(suggestName(widget({ title: '  Lemmy  ' }), 'Custom API')).toBe('Lemmy');
  });

  it('falls back to the catalog label, then the raw type', () => {
    expect(suggestName(widget(), 'Custom API')).toBe('Custom API');
    expect(suggestName(widget())).toBe('custom-api');
  });

  it('ignores a blank title', () => {
    expect(suggestName(widget({ title: '   ' }), 'Custom API')).toBe('Custom API');
  });
});

describe('instantiate', () => {
  it('hands out a copy, so editing the placed widget leaves the entry alone', () => {
    const saved = makeSaved(widget({ url: 'https://example.com' }), 'Mine');
    const placed = instantiate(saved);

    expect(placed.id).not.toBe(saved.widget.id);
    placed.props['url'] = 'https://changed.example.com';
    expect(saved.widget.props['url']).toBe('https://example.com');
  });

  it('gives two placements distinct ids', () => {
    const saved = makeSaved(widget(), 'Mine');
    expect(instantiate(saved).id).not.toBe(instantiate(saved).id);
  });

  it('deep-copies nested children', () => {
    const child: WidgetInstance = { id: 'c1', type: 'hacker-news', props: {} };
    const saved = makeSaved({ id: 'g1', type: 'group', props: {}, children: [child] }, 'Tabs');
    const placed = instantiate(saved);

    expect(placed.children).toHaveLength(1);
    expect(placed.children![0]!.id).not.toBe(child.id);
  });
});

describe('makeSaved', () => {
  it('detaches from the source widget at save time', () => {
    const source = widget({ url: 'https://example.com' });
    const saved = makeSaved(source, 'Mine');
    source.props['url'] = 'https://moved.example.com';
    expect(saved.widget.props['url']).toBe('https://example.com');
  });

  it('keeps a pasted widget placeable a second time', () => {
    const result = importWidgetYaml('- type: custom-api\n  title: Lemmy\n  url: https://lemmy.world\n  template: x\n');
    if (!result.ok) throw new Error('expected success');

    const saved = makeSaved(result.widgets[0]!, suggestName(result.widgets[0]!));
    expect(saved.name).toBe('Lemmy');
    expect(instantiate(saved).props).toEqual(result.widgets[0]!.props);
  });
});

describe('parseSaved', () => {
  it('reads back what it stored', () => {
    const entries = [makeSaved(widget({ title: 'A' }), 'A')];
    expect(parseSaved(JSON.parse(JSON.stringify(entries)))).toEqual(entries);
  });

  it('discards malformed entries rather than throwing', () => {
    expect(parseSaved([{ id: 'x' }, null, 'nope', { id: 'y', name: 'Y', widget: {} }])).toEqual([]);
  });

  it('returns nothing for anything that is not a list', () => {
    expect(parseSaved(undefined)).toEqual([]);
    expect(parseSaved({})).toEqual([]);
  });
});
