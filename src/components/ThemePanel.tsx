import type { CSSProperties } from 'react';
import type { HSL, ThemeConfig } from '../model/theme';
import {
  THEME_DEFAULTS,
  THEME_PRESETS,
  hexToHsl,
  hslToHex,
  hslToString,
  isThemeEmpty,
  themeCssVars,
} from '../model/theme';
import { useStore } from '../model/store';

type ColorKey = 'backgroundColor' | 'primaryColor' | 'positiveColor' | 'negativeColor';

const COLORS: Array<{ key: ColorKey; label: string; yaml: string; fallback: () => HSL | undefined }> = [
  { key: 'backgroundColor', label: 'Background', yaml: 'background-color', fallback: () => THEME_DEFAULTS.backgroundColor },
  { key: 'primaryColor', label: 'Primary', yaml: 'primary-color', fallback: () => THEME_DEFAULTS.primaryColor },
  { key: 'positiveColor', label: 'Positive', yaml: 'positive-color', fallback: () => undefined },
  { key: 'negativeColor', label: 'Negative', yaml: 'negative-color', fallback: () => THEME_DEFAULTS.negativeColor },
];

export function ThemePanel({ onClose }: { onClose: () => void }) {
  const { state, dispatch } = useStore();
  const theme = state.config.theme ?? {};

  const set = (patch: Partial<ThemeConfig>) => dispatch({ type: 'set-theme', theme: { ...theme, ...patch } });
  const replace = (next: ThemeConfig) => dispatch({ type: 'set-theme', theme: next });

  /** A preset matches when every property is identical to the current theme. */
  const activeKey = THEME_PRESETS.find(
    (preset) => JSON.stringify(normalize(preset.theme)) === JSON.stringify(normalize(theme)),
  )?.key;

  const groups = ['Built-in', 'Dark', 'Light'] as const;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal theme-modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>Dashboard theme</h2>
          <button className="ghost" onClick={onClose} title="Close">
            ✕
          </button>
        </header>

        <div className="body theme-body">
          <div className="theme-left">
            {groups.map((group) => (
              <div className="preset-group" key={group}>
                <div className="theme-section-title" style={{ marginBottom: 8 }}>
                  {group}
                </div>
                <div className="preset-grid">
                  {THEME_PRESETS.filter((p) => p.group === group).map((preset) => (
                    <button
                      key={preset.key}
                      className={`preset${activeKey === preset.key ? ' active' : ''}`}
                      title={preset.name}
                      onClick={() => replace(preset.theme)}
                    >
                      <span className="preset-swatches" style={themeCssVars(preset.theme) as CSSProperties}>
                        <span className="swatch primary" />
                        <span className="swatch positive" />
                        <span className="swatch negative" />
                      </span>
                      <span className="preset-name">{preset.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="theme-right">
            <div className="theme-section">
              <div className="theme-section-title">Preview</div>
              <ThemePreview theme={theme} />
            </div>

            <div className="theme-section">
              <div className="theme-section-title">Colours</div>
              {COLORS.map((color) => (
                <ColorRow
                  key={color.key}
                  label={color.label}
                  yamlKey={color.yaml}
                  value={theme[color.key]}
                  fallback={color.fallback()}
                  onChange={(v) => set({ [color.key]: v } as Partial<ThemeConfig>)}
                />
              ))}
            </div>

            <div className="theme-section">
              <div className="theme-section-title">Adjustments</div>

              <div className="field">
                <div className="field checkbox">
                  <input
                    id="theme-light"
                    type="checkbox"
                    checked={theme.light === true}
                    onChange={(e) => set({ light: e.target.checked ? true : undefined })}
                  />
                  <label htmlFor="theme-light">Light mode</label>
                </div>
                <span className="help">
                  Inverts how Glance derives every shade from the background colour. Set this
                  whenever the background is light.
                </span>
              </div>

              <Multiplier
                label="Contrast"
                yamlKey="contrast-multiplier"
                value={theme.contrastMultiplier}
                placeholder={THEME_DEFAULTS.contrastMultiplier}
                min={0.5}
                max={2}
                onChange={(v) => set({ contrastMultiplier: v })}
              />
              <Multiplier
                label="Text saturation"
                yamlKey="text-saturation-multiplier"
                value={theme.textSaturationMultiplier}
                placeholder={THEME_DEFAULTS.textSaturationMultiplier}
                min={0}
                max={2}
                onChange={(v) => set({ textSaturationMultiplier: v })}
              />
            </div>
          </div>
        </div>

        <footer>
          <button onClick={() => replace({})} disabled={isThemeEmpty(theme)}>
            Clear theme
          </button>
          <span className="spacer" />
          <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>
            {isThemeEmpty(theme)
              ? 'No theme block will be written — Glance uses its default dark theme.'
              : 'Written as a top-level theme: block in the exported YAML.'}
          </span>
        </footer>
      </div>
    </div>
  );
}

/** Drops undefined keys so two themes compare equal regardless of key order. */
function normalize(theme: ThemeConfig): unknown {
  const entries = Object.entries(theme)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return entries;
}

function ColorRow({
  label,
  yamlKey,
  value,
  fallback,
  onChange,
}: {
  label: string;
  yamlKey: string;
  value: HSL | undefined;
  fallback: HSL | undefined;
  onChange: (value: HSL | undefined) => void;
}) {
  const effective = value ?? fallback;

  return (
    <div className="color-row">
      <input
        type="color"
        aria-label={label}
        value={hslToHex(effective ?? { h: 0, s: 0, l: 50 })}
        onChange={(e) => onChange(hexToHsl(e.target.value))}
      />
      <div className="color-meta">
        <span className="color-label">{label}</span>
        <span className="color-value">
          {value ? hslToString(value) : fallback ? `${hslToString(fallback)} (default)` : 'follows primary'}
        </span>
      </div>
      <code className="color-key">{yamlKey}</code>
      <button
        className="ghost"
        title="Use the Glance default"
        disabled={value === undefined}
        onClick={() => onChange(undefined)}
      >
        ↺
      </button>
    </div>
  );
}

function Multiplier({
  label,
  yamlKey,
  value,
  placeholder,
  min,
  max,
  onChange,
}: {
  label: string;
  yamlKey: string;
  value: number | undefined;
  placeholder: number;
  min: number;
  max: number;
  onChange: (value: number | undefined) => void;
}) {
  return (
    <div className="field">
      <label className="label-row">
        <span>{label}</span>
        <code className="color-key">{yamlKey}</code>
      </label>
      <div className="slider-row">
        <input
          type="range"
          min={min}
          max={max}
          step={0.05}
          value={value ?? placeholder}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <span className="slider-value">{(value ?? placeholder).toFixed(2)}</span>
        <button className="ghost" title="Use the Glance default" disabled={value === undefined} onClick={() => onChange(undefined)}>
          ↺
        </button>
      </div>
    </div>
  );
}

/**
 * A miniature dashboard using the same custom properties and calc() expressions
 * as Glance's own stylesheet, so what you see here is what Glance renders.
 */
function ThemePreview({ theme }: { theme: ThemeConfig }) {
  return (
    <div className="theme-preview" style={themeCssVars(theme) as CSSProperties}>
      <div className="tp-bar">
        <span className="tp-brand">glance</span>
        <span className="tp-nav">Home</span>
        <span className="tp-nav dim">Media</span>
      </div>
      <div className="tp-columns">
        {['Calendar', 'Hacker News', 'Markets'].map((title, i) => (
          <div className="tp-widget" key={title}>
            <div className="tp-title">{title}</div>
            <div className="tp-line w80" />
            <div className="tp-line w60" />
            {i === 2 ? (
              <div className="tp-stats">
                <span className="tp-pos">+2.41%</span>
                <span className="tp-neg">−1.08%</span>
              </div>
            ) : (
              <div className="tp-line w70" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
