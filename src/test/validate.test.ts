import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import type { Config, Page } from '../model/types';
import { newColumn, newPage, newWidget } from '../model/reducer';
import { configIssues, missingRequiredFields, pageIssues } from '../model/validate';
import { toYaml } from '../export/toYaml';

const messages = (page: Page, all: Page[] = [page]) => pageIssues(page, all).map((i) => i.message);

describe('validation mirrors Glance isConfigStateValid', () => {
  it('accepts the default page', () => {
    expect(messages(newPage('Home'))).toEqual([]);
  });

  it('rejects an empty page name', () => {
    const page = { ...newPage('Home'), name: '  ' };
    expect(messages(page)).toContain('Page has no name.');
  });

  it('rejects a page with no columns', () => {
    const page = { ...newPage('Home'), columns: [] };
    expect(messages(page)).toContain('Page has no columns.');
  });

  it('rejects four columns', () => {
    const page = { ...newPage('Home'), columns: [...newPage('x').columns, newColumn('small')] };
    expect(messages(page)).toContain('A page cannot have more than 3 columns.');
  });

  it('rejects three columns on a slim page', () => {
    const page: Page = { ...newPage('Home'), width: 'slim' };
    expect(messages(page)).toContain('A slim page cannot have more than 2 columns.');
  });

  it('rejects zero full-width columns', () => {
    const page: Page = { ...newPage('Home'), columns: [newColumn('small'), newColumn('small')] };
    expect(messages(page)).toContain('Page needs at least one full-width column.');
  });

  it('rejects three full-width columns', () => {
    const page: Page = {
      ...newPage('Home'),
      columns: [newColumn('full'), newColumn('full'), newColumn('full')],
    };
    expect(messages(page)).toContain('Page cannot have more than 2 full-width columns.');
  });

  it('rejects the slugs Glance reserves for auth', () => {
    expect(messages({ ...newPage('Login') })).toContain(
      '"login" is reserved by Glance and cannot be a page slug.',
    );
  });

  it('rejects two pages that resolve to the same slug', () => {
    const a = newPage('My Page');
    const b = newPage('my   page');
    expect(messages(a, [a, b])).toContain('Slug "my-page" is already used by another page.');
  });

  it('flags widgets missing required fields', () => {
    const weather = newWidget('weather');
    expect(missingRequiredFields(weather)).toEqual(['Location']);

    weather.props['location'] = 'London, United Kingdom';
    expect(missingRequiredFields(weather)).toEqual([]);
  });

  it('treats a list of blank rows as unfilled', () => {
    const rss = newWidget('rss');
    rss.props['feeds'] = [{ url: '' }];
    expect(missingRequiredFields(rss)).toEqual(['Feeds']);

    rss.props['feeds'] = [{ url: 'https://example.com/rss.xml' }];
    expect(missingRequiredFields(rss)).toEqual([]);
  });

  it('rejects cache durations Glance cannot parse', () => {
    const page = newPage('Home');
    const widget = newWidget('rss');
    widget.props['feeds'] = [{ url: 'https://example.com/rss.xml' }];
    widget.props['cache'] = '1h30m'; // compound durations are not supported upstream
    page.columns[0]!.widgets.push(widget);

    expect(messages(page).some((m) => m.includes('invalid cache duration'))).toBe(true);

    widget.props['cache'] = '2h';
    expect(messages(page).some((m) => m.includes('invalid cache duration'))).toBe(false);
  });

  it('requires at least one page', () => {
    expect(configIssues({ pages: [] })).toEqual([{ message: 'Add at least one page.' }]);
  });
});

describe('secret handling', () => {
  it('emits ${ENV} placeholders verbatim and never resolves them', () => {
    const page = newPage('Home');
    const releases = newWidget('releases');
    releases.props['repositories'] = ['glanceapp/glance'];
    releases.props['token'] = '${GITHUB_TOKEN}';
    page.columns[1]!.widgets.push(releases);

    const config: Config = { pages: [page] };
    const yaml = toYaml(config);

    expect(yaml).toContain('${GITHUB_TOKEN}');
    const parsed = parse(yaml) as {
      pages: Array<{ columns: Array<{ widgets: Array<Record<string, unknown>> }> }>;
    };
    expect(parsed.pages[0]!.columns[1]!.widgets[0]!['token']).toBe('${GITHUB_TOKEN}');
  });
});
