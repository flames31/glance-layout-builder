import type { FieldDef } from '../../catalog/types';

type Props = {
  field: FieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
};

/**
 * Six renderers cover every field in the catalog. Each writes back a value the
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
