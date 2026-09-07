import { useRef, useState } from 'react';
import { useStore } from '../model/store';
import { importConfigYaml } from '../model/importConfig';
import type { Config } from '../model/types';

/**
 * Loads an existing `glance.yml` so a dashboard already in use can be
 * rearranged here. Replaces the current layout, so it asks first.
 */
export function ImportPanel({ onClose }: { onClose: () => void }) {
  const { dispatch } = useStore();
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, setPending] = useState<{ config: Config; warnings: string[] } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const check = (source: string) => {
    setText(source);
    const result = importConfigYaml(source);
    if (!result.ok) {
      setErrors(result.errors);
      setPending(null);
      return;
    }
    setErrors([]);
    setPending({ config: result.config, warnings: result.warnings });
  };

  const apply = () => {
    if (!pending) return;
    const page = pending.config.pages[0]!;
    dispatch({
      type: 'load',
      state: { config: pending.config, activePageId: page.id, selectedWidgetId: null },
    });
    onClose();
  };

  const summary = pending
    ? {
        pages: pending.config.pages.length,
        columns: pending.config.pages.reduce((n, p) => n + p.columns.length, 0),
        widgets: pending.config.pages.reduce(
          (n, p) => n + p.columns.reduce((m, c) => m + countWidgets(c.widgets), 0),
          0,
        ),
      }
    : null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>Load a glance.yml</h2>
          <button className="ghost" onClick={onClose} title="Close">
            ✕
          </button>
        </header>

        <div className="body">
          <p className="desc" style={{ marginTop: 0 }}>
            Load the config you already run, rearrange it here, and export it again. Widgets this
            builder does not recognise still import, keep every property, and export unchanged.
          </p>

          <input
            ref={fileInput}
            type="file"
            accept=".yml,.yaml,text/yaml,application/x-yaml"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) check(await file.text());
              e.target.value = '';
            }}
          />

          <div
            className="dropzone-large"
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={async (e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) check(await file.text());
            }}
          >
            Drop <code>glance.yml</code> here, or click to choose it
          </div>

          <textarea
            className="paste-input"
            value={text}
            spellCheck={false}
            placeholder={'…or paste it here\n\npages:\n  - name: Home\n    columns:\n      - size: full\n        widgets:\n          - type: hacker-news'}
            onChange={(e) => check(e.target.value)}
          />

          {errors.length > 0 && (
            <div className="issues" style={{ borderTop: 'none' }}>
              <h3>Cannot load</h3>
              <ul>
                {errors.map((error, i) => (
                  <li key={i} style={{ cursor: 'default' }}>
                    {error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {summary && (
            <div className="catalog-summary">
              <h3>Ready to load</h3>
              <ul>
                <li>
                  {summary.pages} page{summary.pages === 1 ? '' : 's'} · {summary.columns} columns ·{' '}
                  {summary.widgets} widgets
                </li>
              </ul>
              {pending!.warnings.length > 0 && (
                <ul className="import-warnings">
                  {pending!.warnings.map((warning, i) => (
                    <li key={i}>{warning}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <footer>
          <button
            className="primary"
            disabled={!pending}
            onClick={() => {
              if (confirm('Replace the current layout with this config?')) apply();
            }}
          >
            Replace current layout
          </button>
          <span className="spacer" />
          <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>
            Read in the browser — nothing is uploaded anywhere.
          </span>
        </footer>
      </div>
    </div>
  );
}

function countWidgets(widgets: { children?: unknown[] }[]): number {
  return widgets.reduce(
    (n, w) => n + 1 + countWidgets((w.children ?? []) as { children?: unknown[] }[]),
    0,
  );
}
