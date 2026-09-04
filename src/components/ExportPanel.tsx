import { useMemo, useState } from 'react';
import { toYaml } from '../export/toYaml';
import { configIssues } from '../model/validate';
import { useStore } from '../model/store';

export function ExportPanel({ onClose }: { onClose: () => void }) {
  const { state } = useStore();
  const [copied, setCopied] = useState(false);

  const yaml = useMemo(() => toYaml(state.config), [state.config]);
  const issues = useMemo(() => configIssues(state.config), [state.config]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(yaml);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([yaml], { type: 'text/yaml' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'glance.yml';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>glance.yml</h2>
          <button className="ghost" onClick={onClose} title="Close">
            ✕
          </button>
        </header>

        <div className="body">
          {issues.length > 0 && (
            <div className="issues" style={{ borderTop: 'none', paddingTop: 0 }}>
              <h3>{issues.length} issue(s) — Glance may reject this config</h3>
              <ul>
                {issues.map((issue, i) => (
                  <li key={i}>{issue.message}</li>
                ))}
              </ul>
            </div>
          )}
          <pre>{yaml}</pre>
        </div>

        <footer>
          <button className="primary" onClick={copy}>
            {copied ? 'Copied' : 'Copy to clipboard'}
          </button>
          <button onClick={download}>Download glance.yml</button>
          <span className="spacer" />
          <span className="help" style={{ color: 'var(--text-faint)', fontSize: 12 }}>
            Save as glance.yml next to your Glance binary, or mount it into the container.
          </span>
        </footer>
      </div>
    </div>
  );
}
