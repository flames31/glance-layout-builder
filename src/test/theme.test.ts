import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import type { HSL } from '../model/theme';
import {
  THEME_PRESETS,
  hexToHsl,
  hslToHex,
  hslToString,
  isThemeEmpty,
  isValidHsl,
} from '../model/theme';
import { initialState, reducer } from '../model/reducer';
import { toYaml } from '../export/toYaml';
import { themeIssues } from '../model/validate';

type Parsed = { theme?: Record<string, unknown>; pages: unknown[] };
const emit = (theme: Parameters<typeof reducer>[1] extends never ? never : object) =>
  parse(toYaml({ ...initialState().config, theme })) as Parsed;

describe('theme emission', () => {
  it('writes no theme block when nothing is set', () => {
    const parsed = parse(toYaml(initialState().config)) as Parsed;
    expect(parsed.theme).toBeUndefined();
    expect(isThemeEmpty(undefined)).toBe(true);
    expect(isThemeEmpty({})).toBe(true);
  });

  it('writes colours in the scalar form hslColorField accepts', () => {
    const parsed = emit({ backgroundColor: { h: 240, s: 21, l: 15 } });
    // Glance's regex is ^(?:hsla?\()?([\d.]+)(?: |,)+([\d.]+)%?(?: |,)+([\d.]+)%?\)?$
    expect(parsed.theme!['background-color']).toBe('240 21 15');
    expect(String(parsed.theme!['background-color'])).toMatch(/^[\d.]+ [\d.]+ [\d.]+$/);
  });

  it('writes only the properties that were set', () => {
    const parsed = emit({ primaryColor: { h: 43, s: 59, l: 81 }, contrastMultiplier: 1.2 });
    expect(Object.keys(parsed.theme!).sort()).toEqual(['contrast-multiplier', 'primary-color']);
  });

  it('puts theme before pages', () => {
    const yaml = toYaml({ ...initialState().config, theme: { light: true } });
    expect(yaml.indexOf('theme:')).toBeLessThan(yaml.indexOf('pages:'));
  });

  it('emits light as a boolean, not a string', () => {
    expect(emit({ light: true }).theme!['light']).toBe(true);
  });
});

describe('theme survives editing', () => {
  it('is not wiped by page and widget mutations', () => {
    let state = reducer(initialState(), { type: 'set-theme', theme: { light: true } });
    const page = state.config.pages[0]!;

    state = reducer(state, {
      type: 'add-widget',
      pageId: page.id,
      columnId: page.columns[0]!.id,
      parentId: null,
      widgetType: 'rss',
    });
    state = reducer(state, { type: 'add-page' });
    state = reducer(state, { type: 'update-page', pageId: page.id, patch: { name: 'Renamed' } });
    state = reducer(state, { type: 'add-column', pageId: state.activePageId, size: 'small' });
    state = reducer(state, { type: 'remove-widget', widgetId: state.selectedWidgetId ?? 'none' });
    state = reducer(state, { type: 'remove-page', pageId: state.activePageId });

    expect(state.config.theme).toEqual({ light: true });
  });

  it('is cleared by reset', () => {
    const themed = reducer(initialState(), { type: 'set-theme', theme: { light: true } });
    expect(reducer(themed, { type: 'reset' }).config.theme).toBeUndefined();
  });
});

describe('colour conversion', () => {
  it('round-trips hex through HSL within rounding tolerance', () => {
    for (const hex of ['#151519', '#1e1e2e', '#ffffff', '#000000', '#89b4fa', '#f38ba8']) {
      expect(hslToHex(hexToHsl(hex))).toBe(hex);
    }
  });

  it('keeps every preset inside the bounds Glance enforces', () => {
    for (const preset of THEME_PRESETS) {
      const colors: Array<HSL | undefined> = [
        preset.theme.backgroundColor,
        preset.theme.primaryColor,
        preset.theme.positiveColor,
        preset.theme.negativeColor,
      ];
      for (const color of colors) {
        if (color) expect(isValidHsl(color), `${preset.key}: ${hslToString(color)}`).toBe(true);
      }
      expect(themeIssues(preset.theme), preset.key).toEqual([]);
    }
  });
});

describe('theme validation', () => {
  it('rejects out-of-range colours', () => {
    const issues = themeIssues({ primaryColor: { h: 400, s: 50, l: 50 } });
    expect(issues[0]!.message).toContain('primary-color is out of range');
  });

  it('rejects non-positive multipliers', () => {
    expect(themeIssues({ contrastMultiplier: 0 })[0]!.message).toContain('must be a positive number');
  });

  it('accepts an untouched theme', () => {
    expect(themeIssues(undefined)).toEqual([]);
  });
});
