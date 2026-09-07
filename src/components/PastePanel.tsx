import { useState } from 'react';
import { importWidgetYaml } from '../model/importWidget';
import type { WidgetInstance } from '../model/types';

type Props = {
  onImport: (widgets: WidgetInstance[]) => void;
  onClose: () => void;
};

const EXAMPLE = `- type: custom-api
  title: My widget
  url: https://api.example.com/data
  template: |
    <p>{{ .JSON.String "message" }}</p>`;

/**
 * Paste a widget from wherever it was published — a community widget's README,
 * a forum post, an existing config — and drop it straight into the layout.
 */
export function PastePanel({ onImport, onClose }: Props) {
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const submit = () => {
    const result = importWidgetYaml(text);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    onImport(result.widgets);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>Paste a widget</h2>
          <button className="ghost" onClick={onClose} title="Close">
            ✕
          </button>
        </header>

        <div className="body">
          <p className="desc" style={{ marginTop: 0 }}>
            The YAML for one or more widgets — a community widget's snippet, or a chunk of an
            existing <code>glance.yml</code>. Every property is kept and written back out on export,
            so templates and headers survive the round trip.
          </p>

          <textarea
            className="paste-input"
            value={text}
            spellCheck={false}
            placeholder={EXAMPLE}
            onChange={(e) => {
              setText(e.target.value);
              if (errors.length > 0) setErrors([]);
            }}
          />

          {errors.length > 0 && (
            <div className="issues" style={{ borderTop: 'none' }}>
              <h3>Not imported</h3>
              <ul>
                {errors.map((error, i) => (
                  <li key={i} style={{ cursor: 'default' }}>
                    {error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <footer>
          <button className="primary" disabled={text.trim() === ''} onClick={submit}>
            Add to layout
          </button>
          <span className="spacer" />
          <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>
            Nothing is fetched or run — the snippet is carried through to your config as written.
          </span>
        </footer>
      </div>
    </div>
  );
}
