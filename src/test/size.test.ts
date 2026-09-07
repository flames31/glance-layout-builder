import { describe, expect, it } from 'vitest';
import type { WidgetInstance } from '../model/types';
import { DEFAULT_HINT_PX, WIDGET_GAP, estimateColumn, estimateHeight } from '../model/size';

let counter = 0;
function widget(type: string, props: Record<string, unknown> = {}, extra: Partial<WidgetInstance> = {}): WidgetInstance {
  counter += 1;
  return { id: `w${counter}`, type, props, ...extra };
}

describe('collapsible lists', () => {
  it('shows only collapse-after rows, not the full limit', () => {
    const collapsed = estimateHeight(widget('hacker-news', { limit: 30, 'collapse-after': 5 }));
    const short = estimateHeight(widget('hacker-news', { limit: 5, 'collapse-after': 5 }));
    // Both render 5 rows; the collapsed one adds the "show more" button.
    expect(collapsed.px).toBeGreaterThan(short.px);
    expect(collapsed.px - short.px).toBeLessThan(60);
  });

  it('treats a negative collapse-after as never collapsing', () => {
    const never = estimateHeight(widget('rss', { limit: 20, 'collapse-after': -1 }));
    const capped = estimateHeight(widget('rss', { limit: 20, 'collapse-after': 5 }));
    expect(never.px).toBeGreaterThan(capped.px);
  });

  it('grows with the limit only while below collapse-after', () => {
    const ten = estimateHeight(widget('rss', { limit: 10, 'collapse-after': -1 })).px;
    const twenty = estimateHeight(widget('rss', { limit: 20, 'collapse-after': -1 })).px;
    expect(twenty).toBeGreaterThan(ten);
  });

  it('applies catalog defaults when limit and collapse-after are unset', () => {
    // hacker-news defaults to limit 15, collapse-after 5.
    expect(estimateHeight(widget('hacker-news')).px).toEqual(
      estimateHeight(widget('hacker-news', { limit: 15, 'collapse-after': 5 })).px,
    );
  });
});

describe('prop-driven widgets', () => {
  it('scales monitor with the number of sites', () => {
    const one = estimateHeight(widget('monitor', { sites: [{}] })).px;
    const six = estimateHeight(widget('monitor', { sites: [{}, {}, {}, {}, {}, {}] })).px;
    expect(six).toBeGreaterThan(one);
  });

  it('packs dynamic-columns monitors into fewer rows than compact', () => {
    const sites = [{}, {}, {}, {}];
    const compact = estimateHeight(widget('monitor', { sites, style: 'compact' })).px;
    const dynamic = estimateHeight(widget('monitor', { sites, style: 'dynamic-columns' })).px;
    expect(dynamic).toBeLessThan(compact);
  });

  it('counts every link across every bookmark group', () => {
    const one = estimateHeight(widget('bookmarks', { groups: [{ links: [{}] }] })).px;
    const many = estimateHeight(
      widget('bookmarks', { groups: [{ links: [{}, {}, {}] }, { links: [{}, {}] }] }),
    ).px;
    expect(many).toBeGreaterThan(one);
  });

  it('reads numeric props that arrive as strings from form inputs', () => {
    expect(estimateHeight(widget('rss', { limit: '20', 'collapse-after': '-1' })).px).toEqual(
      estimateHeight(widget('rss', { limit: 20, 'collapse-after': -1 })).px,
    );
  });
});

describe('basis', () => {
  it('reports iframe as exact, straight from its height prop', () => {
    expect(estimateHeight(widget('iframe', { height: 500 }))).toEqual({ px: 500, basis: 'exact' });
  });

  it('falls back to the hint for widgets rendering arbitrary content', () => {
    for (const type of ['custom-api', 'html', 'extension']) {
      expect(estimateHeight(widget(type)).basis).toBe('hint');
    }
  });

  it('uses the stored hint when one is set', () => {
    expect(estimateHeight(widget('custom-api', {}, { heightHint: 640 }))).toEqual({
      px: 640,
      basis: 'hint',
    });
  });

  it('defaults an unhinted unknowable widget rather than collapsing it', () => {
    expect(estimateHeight(widget('html')).px).toBe(DEFAULT_HINT_PX);
  });

  it('treats a type outside the catalog as unknowable', () => {
    expect(estimateHeight(widget('not-a-real-widget')).basis).toBe('hint');
  });

  it('derives everything else', () => {
    for (const type of ['rss', 'monitor', 'calendar', 'weather', 'clock', 'markets']) {
      expect(estimateHeight(widget(type)).basis).toBe('derived');
    }
  });
});

describe('containers', () => {
  it('sizes a group to its tallest child, since tabs overlay', () => {
    const tall = widget('rss', { limit: 25, 'collapse-after': -1 });
    const short = widget('clock');
    const group = widget('group', {}, { children: [tall, short] });

    const tallest = Math.max(estimateHeight(tall).px, estimateHeight(short).px);
    const sum = estimateHeight(tall).px + estimateHeight(short).px;

    expect(estimateHeight(group).px).toBeGreaterThanOrEqual(tallest);
    expect(estimateHeight(group).px).toBeLessThan(sum);
  });

  it('divides a split-column across its sub-columns', () => {
    const children = [widget('clock'), widget('clock'), widget('clock'), widget('clock')];
    const two = estimateHeight(widget('split-column', { 'max-columns': 2 }, { children })).px;
    const four = estimateHeight(widget('split-column', { 'max-columns': 4 }, { children })).px;
    expect(four).toBeLessThan(two);
  });

  it('gives an empty container a placeholder height rather than zero', () => {
    expect(estimateHeight(widget('group', {}, { children: [] })).px).toBeGreaterThan(0);
  });
});

describe('estimateColumn', () => {
  it('is zero for an empty column', () => {
    expect(estimateColumn([])).toBe(0);
  });

  it('adds no gap for a single widget', () => {
    const only = widget('clock');
    expect(estimateColumn([only])).toBe(estimateHeight(only).px);
  });

  it('adds one inter-widget gap between each pair', () => {
    const a = widget('clock');
    const b = widget('calendar');
    const c = widget('weather');
    const sum = [a, b, c].reduce((total, w) => total + estimateHeight(w).px, 0);
    expect(estimateColumn([a, b, c])).toBe(sum + 2 * WIDGET_GAP);
  });
});
