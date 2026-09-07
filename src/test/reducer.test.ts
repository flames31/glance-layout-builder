import { describe, expect, it } from 'vitest';
import type { Action, EditorState } from '../model/reducer';
import { initialState, newPage, reducer } from '../model/reducer';
import { getWidget, locateWidget } from '../model/tree';

const run = (state: EditorState, ...actions: Action[]) => actions.reduce(reducer, state);

/** Adds a widget to the given column and returns the new state plus its id. */
function add(state: EditorState, columnIndex: number, widgetType: string) {
  const page = state.config.pages.find((p) => p.id === state.activePageId)!;
  const next = reducer(state, {
    type: 'add-widget',
    pageId: page.id,
    columnId: page.columns[columnIndex]!.id,
    parentId: null,
    widgetType,
  });
  return { state: next, id: next.selectedWidgetId! };
}

describe('reducer', () => {
  it('starts with one page shaped like the Glance starter config', () => {
    const state = initialState();
    expect(state.config.pages).toHaveLength(1);
    expect(state.config.pages[0]!.columns.map((c) => c.size)).toEqual(['small', 'full', 'small']);
  });

  it('adds a widget and selects it', () => {
    const { state, id } = add(initialState(), 0, 'rss');
    expect(getWidget(state.config, id)?.type).toBe('rss');
    expect(state.selectedWidgetId).toBe(id);
  });

  it('moves a widget between columns', () => {
    const start = initialState();
    const { state, id } = add(start, 0, 'rss');
    const page = state.config.pages[0]!;

    const moved = reducer(state, {
      type: 'move-widget',
      widgetId: id,
      pageId: page.id,
      columnId: page.columns[1]!.id,
      parentId: null,
      index: 0,
    });

    expect(locateWidget(moved.config, id)?.columnId).toBe(page.columns[1]!.id);
    expect(moved.config.pages[0]!.columns[0]!.widgets).toHaveLength(0);
  });

  it('nests a widget inside a group and refuses to nest a container', () => {
    const withGroup = add(initialState(), 1, 'group');
    const withRss = add(withGroup.state, 0, 'rss');
    const page = withRss.state.config.pages[0]!;

    const nested = reducer(withRss.state, {
      type: 'move-widget',
      widgetId: withRss.id,
      pageId: page.id,
      columnId: page.columns[1]!.id,
      parentId: withGroup.id,
      index: 0,
    });
    expect(getWidget(nested.config, withGroup.id)?.children?.[0]?.id).toBe(withRss.id);

    // A second group must not end up inside the first.
    const withSplit = add(nested, 0, 'split-column');
    const rejected = reducer(withSplit.state, {
      type: 'move-widget',
      widgetId: withSplit.id,
      pageId: page.id,
      columnId: page.columns[1]!.id,
      parentId: withGroup.id,
      index: 0,
    });
    expect(getWidget(rejected.config, withGroup.id)?.children).toHaveLength(1);
    expect(locateWidget(rejected.config, withSplit.id)?.parentId).toBeNull();
  });

  it('duplicates a widget with fresh ids, including nested children', () => {
    const withGroup = add(initialState(), 1, 'group');
    const page = withGroup.state.config.pages[0]!;
    const withChild = reducer(withGroup.state, {
      type: 'add-widget',
      pageId: page.id,
      columnId: page.columns[1]!.id,
      parentId: withGroup.id,
      widgetType: 'hacker-news',
    });

    const duped = reducer(withChild, { type: 'duplicate-widget', widgetId: withGroup.id });
    const copyId = duped.selectedWidgetId!;
    expect(copyId).not.toBe(withGroup.id);

    const copy = getWidget(duped.config, copyId)!;
    expect(copy.children).toHaveLength(1);
    expect(copy.children![0]!.id).not.toBe(withChild.selectedWidgetId);
  });

  it('removes widgets and clears the selection', () => {
    const { state, id } = add(initialState(), 0, 'rss');
    const removed = reducer(state, { type: 'remove-widget', widgetId: id });
    expect(getWidget(removed.config, id)).toBeUndefined();
    expect(removed.selectedWidgetId).toBeNull();
  });

  it('stores props and deletes them when cleared', () => {
    const { state, id } = add(initialState(), 0, 'reddit');
    const set = reducer(state, { type: 'set-prop', widgetId: id, key: 'subreddit', value: 'selfhosted' });
    expect(getWidget(set.config, id)?.props['subreddit']).toBe('selfhosted');

    const cleared = reducer(set, { type: 'set-prop', widgetId: id, key: 'subreddit', value: '' });
    expect(getWidget(cleared.config, id)?.props).not.toHaveProperty('subreddit');
  });

  it('refuses to delete the last page', () => {
    const state = initialState();
    const after = reducer(state, { type: 'remove-page', pageId: state.config.pages[0]!.id });
    expect(after.config.pages).toHaveLength(1);
  });

  it('switches to a surviving page when the active one is deleted', () => {
    const state = run(initialState(), { type: 'add-page' });
    expect(state.config.pages).toHaveLength(2);
    const after = reducer(state, { type: 'remove-page', pageId: state.activePageId });
    expect(after.config.pages).toHaveLength(1);
    expect(after.activePageId).toBe(after.config.pages[0]!.id);
  });
});

describe('reducer enforces Glance layout rules', () => {
  const page = () => initialState().config.pages[0]!;

  it('will not add a fourth column', () => {
    const state = initialState();
    const after = reducer(state, { type: 'add-column', pageId: page().id, size: 'small' });
    expect(after.config.pages[0]!.columns).toHaveLength(3);
  });

  it('will not add a third full column', () => {
    let state = initialState();
    const pageId = state.config.pages[0]!.id;
    // small/full/small -> make the first small full, giving 2 full columns.
    state = reducer(state, {
      type: 'set-column-size',
      pageId,
      columnId: state.config.pages[0]!.columns[0]!.id,
      size: 'full',
    });
    expect(state.config.pages[0]!.columns.filter((c) => c.size === 'full')).toHaveLength(2);

    // A third would break "1 or 2 full width columns".
    const after = reducer(state, {
      type: 'set-column-size',
      pageId,
      columnId: state.config.pages[0]!.columns[2]!.id,
      size: 'full',
    });
    expect(after.config.pages[0]!.columns.filter((c) => c.size === 'full')).toHaveLength(2);
  });

  it('will not leave a page with zero full columns', () => {
    const state = initialState();
    const pageId = state.config.pages[0]!.id;
    const fullColumn = state.config.pages[0]!.columns[1]!;

    const resized = reducer(state, {
      type: 'set-column-size',
      pageId,
      columnId: fullColumn.id,
      size: 'small',
    });
    expect(resized.config.pages[0]!.columns[1]!.size).toBe('full');

    const removed = reducer(state, { type: 'remove-column', pageId, columnId: fullColumn.id });
    expect(removed.config.pages[0]!.columns).toHaveLength(3);
  });

  it('caps a slim page at two columns', () => {
    let state = initialState();
    const pageId = state.config.pages[0]!.id;
    state = reducer(state, {
      type: 'remove-column',
      pageId,
      columnId: state.config.pages[0]!.columns[2]!.id,
    });
    state = reducer(state, { type: 'update-page', pageId, patch: { width: 'slim' } });
    expect(state.config.pages[0]!.columns).toHaveLength(2);

    const after = reducer(state, { type: 'add-column', pageId, size: 'small' });
    expect(after.config.pages[0]!.columns).toHaveLength(2);
  });

  it('gives every new page a valid starting layout', () => {
    const fresh = newPage('Media');
    expect(fresh.columns.filter((c) => c.size === 'full')).toHaveLength(1);
    expect(fresh.columns.length).toBeLessThanOrEqual(3);
  });
});

describe('set-height-hint', () => {
  it('stores the hint outside props, so the emitter cannot pick it up', () => {
    const { state, id } = add(initialState(), 0, 'custom-api');
    const next = reducer(state, { type: 'set-height-hint', widgetId: id, px: 640 });

    const widget = getWidget(next.config, id)!;
    expect(widget.heightHint).toBe(640);
    expect(widget.props).not.toHaveProperty('heightHint');
    expect(Object.keys(widget.props)).toHaveLength(0);
  });

  it('rounds to whole pixels and refuses a zero height', () => {
    const { state, id } = add(initialState(), 0, 'html');
    expect(getWidget(reducer(state, { type: 'set-height-hint', widgetId: id, px: 412.6 }).config, id)!.heightHint).toBe(413);
    expect(getWidget(reducer(state, { type: 'set-height-hint', widgetId: id, px: 0 }).config, id)!.heightHint).toBe(1);
  });

  it('clears the hint when given no value', () => {
    const { state, id } = add(initialState(), 0, 'html');
    const set = reducer(state, { type: 'set-height-hint', widgetId: id, px: 500 });
    const cleared = reducer(set, { type: 'set-height-hint', widgetId: id, px: undefined });
    expect(getWidget(cleared.config, id)!).not.toHaveProperty('heightHint');
  });

  it('reaches a widget nested inside a container', () => {
    const { state, id: groupId } = add(initialState(), 0, 'group');
    const page = state.config.pages[0]!;
    const withChild = reducer(state, {
      type: 'add-widget',
      pageId: page.id,
      columnId: page.columns[0]!.id,
      parentId: groupId,
      widgetType: 'custom-api',
    });
    const childId = withChild.selectedWidgetId!;
    const next = reducer(withChild, { type: 'set-height-hint', widgetId: childId, px: 250 });
    expect(getWidget(next.config, childId)!.heightHint).toBe(250);
  });
});
