import { useRef, useState } from 'react';
import { useStore } from '../model/store';
import { parseCatalogFile } from '../model/catalogSource';

/**
 * Loads a catalog generated from the user's own Glance checkout, so the widget
 * menu matches the build they actually run.
 */
export function CatalogPanel({ onClose }: { onClose: () => void }) {
  const { catalog, setCatalog } = useStore();
  const [errors, setErrors] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const accept = async (file: File) => {
    const result = parseCatalogFile(await file.text());
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setCatalog(result.catalog);
    setErrors([]);
  };

  const unavailable = catalog.widgets.filter((w) => !w.available);
  const added = catalog.widgets.filter((w) => w.generated);
  const extras = catalog.widgets.reduce((n, w) => n + w.extraFields.length, 0);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>Widget catalog</h2>
          <button className="ghost" onClick={onClose} title="Close">
            ✕
          </button>
        </header>

        <div className="body">
          <p className="desc" style={{ marginTop: 0 }}>
            Glance has no endpoint that reports which widgets it supports, so the menu here is a
            hand-written list that can drift from your build. Generate one from your own checkout
            and the menu will match it exactly — including widgets a fork adds, and excluding ones
            your build does not have.
          </p>

          <pre>npm run catalog -- /path/to/your/glance</pre>

          <p className="desc">
            That writes <code>glance-catalog.json</code>. Load it below. It records key names and
            types only — no config, no secrets.
          </p>

          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void accept(file);
              e.target.value = '';
            }}
          />

          <div
            className="dropzone-large"
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) void accept(file);
            }}
          >
            Drop <code>glance-catalog.json</code> here, or click to choose it
          </div>

          {errors.length > 0 && (
            <div className="issues" style={{ borderTop: 'none' }}>
              <h3>Not loaded</h3>
              <ul>
                {errors.map((error, i) => (
                  <li key={i} style={{ cursor: 'default' }}>
                    {error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {catalog.source && (
            <div className="catalog-summary">
              <h3>
                Using {catalog.source.label}
                {catalog.source.commit && ` @ ${catalog.source.commit}`}
              </h3>
              <ul>
                <li>{catalog.widgets.filter((w) => w.available).length} widgets available</li>
                {added.length > 0 && (
                  <li>
                    {added.length} not in the built-in catalog: {added.map((w) => w.type).join(', ')}
                  </li>
                )}
                {unavailable.length > 0 && (
                  <li>
                    {unavailable.length} disabled — your build has no{' '}
                    {unavailable.map((w) => w.type).join(', ')}
                  </li>
                )}
                {extras > 0 && <li>{extras} extra properties added across the built-in widgets</li>}
              </ul>
            </div>
          )}
        </div>

        <footer>
          {catalog.source && (
            <button
              onClick={() => {
                setCatalog(null);
                setErrors([]);
              }}
            >
              Back to built-in catalog
            </button>
          )}
          <span className="spacer" />
          <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>
            Kept separately from your layout, so Reset does not clear it.
          </span>
        </footer>
      </div>
    </div>
  );
}
