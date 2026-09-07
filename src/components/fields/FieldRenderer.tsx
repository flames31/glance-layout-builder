import { useEffect, useState } from 'react';
import { parse, stringify } from 'yaml';
import type { FieldDef } from '../../catalog/types';

type Props = {
  field: FieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
};

/**
 * Every field in the catalog renders through here. Each writes back a value the
 * YAML emitter can use directly — no per-widget form code anywhere.
 */
export function FieldRenderer({ field, value, onChange }: Props) {
  switch (field.kind) {
    case 'string':
    case 'url':
    case 'secret':
      return (
        <Labelled field={field}>
          <input
            type="text"
            value={asString(value)}
            placeholder={field.placeholder ?? ''}
            spellCheck={false}
            autoComplete="off"
            onChange={(e) => onChange(e.target.value)}
          />
        </Labelled>
      );

    case 'text':
      return (
        <Labelled field={field}>
          <textarea
            value={asString(value)}
            spellCheck={false}
            onChange={(e) => onChange(e.target.value)}
          />
        </Labelled>
      );

    case 'number':
      return (
        <Labelled field={field}>
          <input
            type="number"
            value={value === undefined || value === null ? '' : String(value)}
            placeholder={field.default !== undefined ? String(field.default) : ''}
            min={field.min}
            onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
          />
        </Labelled>
      );

    case 'boolean':
      return (
        <div className="field checkbox">
          <input
            id={`f-${field.key}`}
            type="checkbox"
            checked={value === true}
            onChange={(e) => onChange(e.target.checked ? true : undefined)}
          />
          <label htmlFor={`f-${field.key}`}>{field.label}</label>
        </div>
      );

    case 'enum':
      return (
        <Labelled field={field}>
          <select value={asString(value)} onChange={(e) => onChange(e.target.value || undefined)}>
            <option value="">{field.default ? `${field.default} (default)` : 'default'}</option>
            {field.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </Labelled>
      );

    case 'stringList':
      return <StringListField field={field} value={value} onChange={onChange} />;

    case 'objectList':
      return <ObjectListField field={field} value={value} onChange={onChange} />;

    case 'keyValue':
      return <KeyValueField field={field} value={value} onChange={onChange} />;

    case 'raw':
      return <RawField field={field} value={value} onChange={onChange} />;
  }
}

/** A `map[string]string`, edited as name/value pairs. */
function KeyValueField({ field, value, onChange }: Props) {
  if (field.kind !== 'keyValue') return null;
  const entries = Object.entries(
    typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {},
  ).map(([k, v]) => [k, asString(v)] as [string, string]);

  const replace = (next: [string, string][]) => {
    // Rows with no name yet are kept in the UI but cannot be written out.
    const named = next.filter(([k]) => k.trim() !== '');
    onChange(named.length > 0 ? Object.fromEntries(named) : undefined);
  };

  return (
    <div className={`field${field.required ? ' required' : ''}`}>
      <label>{field.label}</label>
      <div className="list-rows">
        {entries.map(([k, v], i) => (
          <div className="list-row" key={i}>
            <input
              type="text"
              value={k}
              placeholder="name"
              spellCheck={false}
              onChange={(e) => replace(entries.map((row, j) => (j === i ? [e.target.value, row[1]] : row)))}
            />
            <input
              type="text"
              value={v}
              placeholder="value"
              spellCheck={false}
              onChange={(e) => replace(entries.map((row, j) => (j === i ? [row[0], e.target.value] : row)))}
            />
            <button
              className="ghost danger"
              title="Remove"
              onClick={() => replace(entries.filter((_, j) => j !== i))}
            >
              ✕
            </button>
          </div>
        ))}
        <button onClick={() => replace([...entries, ['', '']])}>+ Add</button>
      </div>
      {field.help && <span className="help">{field.help}</span>}
    </div>
  );
}

/**
 * A shape with no form representation — nested maps, free-form bodies. Edited as
 * YAML and stored parsed, so it emits exactly as typed.
 *
 * The text is held locally while editing: re-deriving it from the parsed value
 * on every keystroke would reformat the field under the user's cursor.
 */
function RawField({ field, value, onChange }: Props) {
  const [text, setText] = useState(() => toYamlText(value));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Re-sync only when the widget selection brings in a different value.
    setText((current) => (equivalent(current, value) ? current : toYamlText(value)));
    setError(null);
  }, [value]);

  if (field.kind !== 'raw') return null;

  return (
    <div className={`field${field.required ? ' required' : ''}`}>
      <label>{field.label}</label>
      <textarea
        value={text}
        spellCheck={false}
        className="raw-input"
        onChange={(e) => {
          setText(e.target.value);
          if (e.target.value.trim() === '') {
            setError(null);
            onChange(undefined);
            return;
          }
          try {
            onChange(parse(e.target.value));
            setError(null);
          } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
          }
        }}
      />
      {error ? <span className="help warn-text">{error}</span> : field.help && <span className="help">{field.help}</span>}
    </div>
  );
}

function toYamlText(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  return stringify(value, { lineWidth: 0 }).trimEnd();
}

/** True when `text` already parses to `value`, so retyping it would be churn. */
function equivalent(text: string, value: unknown): boolean {
  try {
    return JSON.stringify(parse(text === '' ? 'null' : text)) === JSON.stringify(value ?? null);
  } catch {
    return false;
  }
}

function Labelled({ field, children }: { field: FieldDef; children: React.ReactNode }) {
  return (
    <div className={`field${'required' in field && field.required ? ' required' : ''}`}>
      <label>{field.label}</label>
      {children}
      {field.help && <span className="help">{field.help}</span>}
    </div>
  );
}

function asString(value: unknown): string {
  return value === undefined || value === null ? '' : String(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function StringListField({ field, value, onChange }: Props) {
  if (field.kind !== 'stringList') return null;
  const items = asArray(value).map(asString);

  const replace = (next: string[]) => onChange(next.length > 0 ? next : undefined);

  return (
    <div className={`field${field.required ? ' required' : ''}`}>
      <label>{field.label}</label>
      <div className="list-rows">
        {items.map((item, i) => (
          <div className="list-row" key={i}>
            <input
              type="text"
              value={item}
              placeholder={field.itemPlaceholder ?? ''}
              spellCheck={false}
              onChange={(e) => replace(items.map((v, j) => (j === i ? e.target.value : v)))}
            />
            <button
              className="ghost danger"
              title="Remove"
              onClick={() => replace(items.filter((_, j) => j !== i))}
            >
              ✕
            </button>
          </div>
        ))}
        <button onClick={() => replace([...items, ''])}>+ Add</button>
      </div>
      {field.help && <span className="help">{field.help}</span>}
    </div>
  );
}

function ObjectListField({ field, value, onChange }: Props) {
  if (field.kind !== 'objectList') return null;
  const rows = asArray(value) as Array<Record<string, unknown>>;

  const replace = (next: Array<Record<string, unknown>>) => onChange(next.length > 0 ? next : undefined);

  const setRowField = (index: number, key: string, fieldValue: unknown) =>
    replace(
      rows.map((row, i) => {
        if (i !== index) return row;
        const next = { ...row };
        if (fieldValue === undefined || fieldValue === '') delete next[key];
        else next[key] = fieldValue;
        return next;
      }),
    );

  return (
    <div className={`field${field.required ? ' required' : ''}`}>
      <label>{field.label}</label>
      <div className="list-rows">
        {rows.map((row, i) => (
          <div className="object-row" key={i}>
            <div className="object-head">
              <span className="title">{asString(row[field.summaryKey]) || `#${i + 1}`}</span>
              <button
                className="ghost"
                title="Move up"
                disabled={i === 0}
                onClick={() => replace(swap(rows, i, i - 1))}
              >
                ↑
              </button>
              <button
                className="ghost"
                title="Move down"
                disabled={i === rows.length - 1}
                onClick={() => replace(swap(rows, i, i + 1))}
              >
                ↓
              </button>
              <button
                className="ghost danger"
                title="Remove"
                onClick={() => replace(rows.filter((_, j) => j !== i))}
              >
                ✕
              </button>
            </div>
            {field.fields.map((sub) => (
              <FieldRenderer
                key={sub.key}
                field={sub}
                value={row[sub.key]}
                onChange={(v) => setRowField(i, sub.key, v)}
              />
            ))}
          </div>
        ))}
        <button onClick={() => replace([...rows, {}])}>+ Add {field.label.replace(/s$/, '')}</button>
      </div>
      {field.help && <span className="help">{field.help}</span>}
    </div>
  );
}

function swap<T>(list: T[], a: number, b: number): T[] {
  const next = [...list];
  const first = next[a]!;
  next[a] = next[b]!;
  next[b] = first;
  return next;
}
