/**
 * Glance's theme block (`internal/glance/theme.go`, `themeProperties`).
 *
 * Colours are stored as HSL triples because that is the only form Glance's
 * `hslColorField` accepts. The editor converts to and from hex purely so the
 * browser's native colour picker can be used.
 */

export type HSL = { h: number; s: number; l: number };

export type ThemeConfig = {
  backgroundColor?: HSL;
  primaryColor?: HSL;
  positiveColor?: HSL;
  negativeColor?: HSL;
  light?: boolean;
  contrastMultiplier?: number;
  textSaturationMultiplier?: number;
};

/**
 * Glance's built-in values from `static/css/main.css`, used whenever a
 * property is left unset. The preview needs these to show what "unset"
 * actually looks like.
 */
export const THEME_DEFAULTS = {
  backgroundColor: { h: 240, s: 8, l: 9 } as HSL,
  primaryColor: { h: 43, s: 50, l: 70 } as HSL,
  negativeColor: { h: 0, s: 70, l: 70 } as HSL,
  contrastMultiplier: 1,
  textSaturationMultiplier: 1,
};

export function isThemeEmpty(theme: ThemeConfig | undefined): boolean {
  return !theme || Object.values(theme).every((v) => v === undefined);
}

/** Glance's canonical scalar form: `240 8 9`. */
export function hslToString({ h, s, l }: HSL): string {
  return `${round(h)} ${round(s)} ${round(l)}`;
}

export function hslToCss({ h, s, l }: HSL): string {
  return `hsl(${round(h)}, ${round(s)}%, ${round(l)}%)`;
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

export function hslToHex({ h, s, l }: HSL): string {
  const sat = s / 100;
  const lig = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) => lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const hex = (n: number) =>
    Math.round(255 * f(n))
      .toString(16)
      .padStart(2, '0');
  return `#${hex(0)}${hex(8)}${hex(4)}`;
}

export function hexToHsl(hex: string): HSL {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;

  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  return { h: round(h), s: round(s * 100), l: round(l * 100) };
}

/** Bounds enforced by `hslColorField.UnmarshalYAML`. */
export function isValidHsl(color: HSL): boolean {
  return (
    color.h >= 0 && color.h <= 360 && color.s >= 0 && color.s <= 100 && color.l >= 0 && color.l <= 100
  );
}

export type ThemePreset = {
  key: string;
  name: string;
  group: 'Built-in' | 'Dark' | 'Light';
  theme: ThemeConfig;
};

/**
 * Presets transcribed from `docs/themes.md`, plus the two Glance ships with
 * (`internal/glance/glance.go`). Selecting one replaces the theme wholesale;
 * every value stays editable afterwards.
 */
export const THEME_PRESETS: ThemePreset[] = [
  { key: 'default-dark', name: 'Default Dark', group: 'Built-in', theme: {} },
  {
    key: 'default-light',
    name: 'Default Light',
    group: 'Built-in',
    theme: {
      light: true,
      backgroundColor: { h: 240, s: 13, l: 95 },
      primaryColor: { h: 230, s: 100, l: 30 },
      negativeColor: { h: 0, s: 70, l: 50 },
      contrastMultiplier: 1.3,
      textSaturationMultiplier: 0.5,
    },
  },

  {
    key: 'teal-city',
    name: 'Teal City',
    group: 'Dark',
    theme: {
      backgroundColor: { h: 225, s: 14, l: 15 },
      primaryColor: { h: 157, s: 47, l: 65 },
      contrastMultiplier: 1.1,
    },
  },
  {
    key: 'catppuccin-frappe',
    name: 'Catppuccin Frappé',
    group: 'Dark',
    theme: {
      backgroundColor: { h: 229, s: 19, l: 23 },
      contrastMultiplier: 1.2,
      primaryColor: { h: 222, s: 74, l: 74 },
      positiveColor: { h: 96, s: 44, l: 68 },
      negativeColor: { h: 359, s: 68, l: 71 },
    },
  },
  {
    key: 'catppuccin-macchiato',
    name: 'Catppuccin Macchiato',
    group: 'Dark',
    theme: {
      backgroundColor: { h: 232, s: 23, l: 18 },
      contrastMultiplier: 1.2,
      primaryColor: { h: 220, s: 83, l: 75 },
      positiveColor: { h: 105, s: 48, l: 72 },
      negativeColor: { h: 351, s: 74, l: 73 },
    },
  },
  {
    key: 'catppuccin-mocha',
    name: 'Catppuccin Mocha',
    group: 'Dark',
    theme: {
      backgroundColor: { h: 240, s: 21, l: 15 },
      contrastMultiplier: 1.2,
      primaryColor: { h: 217, s: 92, l: 83 },
      positiveColor: { h: 115, s: 54, l: 76 },
      negativeColor: { h: 347, s: 70, l: 65 },
    },
  },
  {
    key: 'camouflage',
    name: 'Camouflage',
    group: 'Dark',
    theme: {
      backgroundColor: { h: 186, s: 21, l: 20 },
      contrastMultiplier: 1.2,
      primaryColor: { h: 97, s: 13, l: 80 },
    },
  },
  {
    key: 'gruvbox-dark',
    name: 'Gruvbox Dark',
    group: 'Dark',
    theme: {
      backgroundColor: { h: 0, s: 0, l: 16 },
      primaryColor: { h: 43, s: 59, l: 81 },
      positiveColor: { h: 61, s: 66, l: 44 },
      negativeColor: { h: 6, s: 96, l: 59 },
    },
  },
  {
    key: 'kanagawa-dark',
    name: 'Kanagawa Dark',
    group: 'Dark',
    theme: {
      backgroundColor: { h: 240, s: 13, l: 14 },
      primaryColor: { h: 51, s: 33, l: 68 },
      negativeColor: { h: 358, s: 100, l: 68 },
      contrastMultiplier: 1.2,
    },
  },
  {
    key: 'tucan',
    name: 'Tucan',
    group: 'Dark',
    theme: {
      backgroundColor: { h: 50, s: 1, l: 6 },
      primaryColor: { h: 24, s: 97, l: 58 },
      negativeColor: { h: 209, s: 88, l: 54 },
    },
  },
  {
    key: 'dracula',
    name: 'Dracula',
    group: 'Dark',
    theme: {
      backgroundColor: { h: 231, s: 15, l: 21 },
      primaryColor: { h: 265, s: 89, l: 79 },
      contrastMultiplier: 1.2,
      positiveColor: { h: 135, s: 94, l: 66 },
      negativeColor: { h: 0, s: 100, l: 67 },
    },
  },
  {
    key: 'shades-of-purple',
    name: 'Shades of Purple',
    group: 'Dark',
    theme: {
      backgroundColor: { h: 243, s: 33, l: 25 },
      contrastMultiplier: 1.2,
      primaryColor: { h: 50, s: 100, l: 49 },
      positiveColor: { h: 98, s: 82, l: 71 },
      negativeColor: { h: 12, s: 77, l: 52 },
    },
  },
  {
    key: 'neon-pink',
    name: 'Neon Pink',
    group: 'Dark',
    theme: {
      backgroundColor: { h: 240, s: 27, l: 11 },
      contrastMultiplier: 1.5,
      primaryColor: { h: 321, s: 100, l: 71 },
      positiveColor: { h: 165, s: 78, l: 51 },
      negativeColor: { h: 360, s: 100, l: 71 },
    },
  },

  {
    key: 'catppuccin-latte',
    name: 'Catppuccin Latte',
    group: 'Light',
    theme: {
      light: true,
      backgroundColor: { h: 220, s: 23, l: 95 },
      contrastMultiplier: 1.0,
      primaryColor: { h: 220, s: 91, l: 54 },
      positiveColor: { h: 109, s: 58, l: 40 },
      negativeColor: { h: 347, s: 87, l: 44 },
    },
  },
  {
    key: 'peachy',
    name: 'Peachy',
    group: 'Light',
    theme: {
      light: true,
      backgroundColor: { h: 28, s: 40, l: 77 },
      primaryColor: { h: 155, s: 100, l: 20 },
      negativeColor: { h: 0, s: 100, l: 60 },
      contrastMultiplier: 1.1,
      textSaturationMultiplier: 0.5,
    },
  },
  {
    key: 'zebra',
    name: 'Zebra',
    group: 'Light',
    theme: {
      light: true,
      backgroundColor: { h: 0, s: 0, l: 95 },
      primaryColor: { h: 0, s: 0, l: 10 },
      negativeColor: { h: 0, s: 90, l: 50 },
    },
  },
];

/**
 * The CSS custom properties Glance's stylesheet reads, so a preview can derive
 * every other colour with the exact same calc() expressions the real dashboard
 * uses (`static/css/main.css`).
 */
export function themeCssVars(theme: ThemeConfig): Record<string, string> {
  const bg = theme.backgroundColor ?? THEME_DEFAULTS.backgroundColor;
  const vars: Record<string, string> = {
    '--bgh': String(bg.h),
    '--bgs': `${bg.s}%`,
    '--bgl': `${bg.l}%`,
    // Light mode inverts every lightness calculation; see site.css.
    '--scheme': theme.light ? '100% -' : ' ',
    '--cm': String(theme.contrastMultiplier ?? THEME_DEFAULTS.contrastMultiplier),
    '--tsm': String(theme.textSaturationMultiplier ?? THEME_DEFAULTS.textSaturationMultiplier),
    '--color-primary': hslToCss(theme.primaryColor ?? THEME_DEFAULTS.primaryColor),
    '--color-negative': hslToCss(theme.negativeColor ?? THEME_DEFAULTS.negativeColor),
  };
  // Glance defaults positive to the primary colour.
  vars['--color-positive'] = theme.positiveColor
    ? hslToCss(theme.positiveColor)
    : vars['--color-primary']!;
  return vars;
}
