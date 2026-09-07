import { useMemo, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { WidgetCategory } from '../catalog/types';
import type { ResolvedWidget } from '../model/catalogSource';
import { useStore } from '../model/store';
import type { SavedWidget } from '../model/savedWidgets';
import { encodeNewId, encodeSavedId } from '../model/dragIds';

const ORDER: WidgetCategory[] = [
  'Feeds',
  'Monitoring',
  'Media',
  'Utility',
  'Layout',
  'Advanced',
  'Imported',
];

type PaletteProps = {
  onAdd: (type: string) => void;
  onAddSaved: (saved: SavedWidget) => void;
  onPaste: () => void;
};

export function Palette({ onAdd, onAddSaved, onPaste }: PaletteProps) {
  const [query, setQuery] = useState('');
  const { catalog, saved, removeSaved, renameSaved } = useStore();

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = catalog.widgets.filter(
      (w) =>
        needle === '' ||
        w.label.toLowerCase().includes(needle) ||
        w.type.includes(needle) ||
        w.description.toLowerCase().includes(needle),
    );
    return ORDER.map((category) => ({
      category,
      widgets: matches.filter((w) => w.category === category),
    })).filter((g) => g.widgets.length > 0);
  }, [query, catalog]);

  const needle = query.trim().toLowerCase();
  const savedMatches = saved.filter(
    (entry) =>
      needle === '' ||
      entry.name.toLowerCase().includes(needle) ||
      entry.widget.type.includes(needle),
  );

  return (
    <>
      <div className="palette-search">
        <input
          type="search"
          value={query}
          placeholder="Search widgets…"
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {groups.length === 0 && savedMatches.length === 0 && (
        <p className="palette-empty">No widget matches “{query}”.</p>
      )}

      {savedMatches.length > 0 && (
        <div className="palette-group" key="saved">
          <h3>My widgets</h3>
          {savedMatches.map((entry) => (
            <SavedItem
              key={entry.id}
              saved={entry}
              onAdd={onAddSaved}
              onRemove={removeSaved}
              onRename={renameSaved}
            />
          ))}
        </div>
      )}

      {groups.map((group) => (
        <div className="palette-group" key={group.category}>
          <h3>{group.category}</h3>
          {group.widgets.map((widget) => (
            <PaletteItem key={widget.type} widget={widget} onAdd={onAdd} />
          ))}
        </div>
      ))}

      <div className="palette-group">
        <h3>Elsewhere</h3>
        <button
          className="palette-item"
          title="Add a widget by pasting its YAML — a community widget, or one from an existing config."
          onClick={onPaste}
        >
          <div className="name">Paste a widget…</div>
          <div className="type">from YAML</div>
        </button>
      </div>
    </>
  );
}

function PaletteItem({ widget, onAdd }: { widget: ResolvedWidget; onAdd: (type: string) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: encodeNewId(widget.type),
    data: { kind: 'new', widgetType: widget.type },
    disabled: !widget.available,
  });

  if (!widget.available) {
    return (
      <button
        className="palette-item unavailable"
        disabled
        title={`Your uploaded catalog has no \`${widget.type}\`, so this Glance build would reject it.`}
      >
        <div className="name">{widget.label}</div>
        <div className="type">not in your build</div>
      </button>
    );
  }

  return (
    <button
      ref={setNodeRef}
      className="palette-item"
      style={isDragging ? { opacity: 0.4 } : undefined}
      title={`${widget.description}\n\nDrag onto a column, or click to add.`}
      onClick={() => onAdd(widget.type)}
      {...listeners}
      {...attributes}
    >
      <div className="name">{widget.label}</div>
      <div className="type">{widget.type}</div>
    </button>
  );
}

/**
 * A widget the user kept, with its properties already filled in. Adding one
 * places a fresh copy, so editing what lands on the canvas never disturbs the
 * stored entry.
 */
function SavedItem({
  saved,
  onAdd,
  onRemove,
  onRename,
}: {
  saved: SavedWidget;
  onAdd: (saved: SavedWidget) => void;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: encodeSavedId(saved.id),
    data: { kind: 'saved', savedId: saved.id },
  });

  if (editing) {
    return (
      <div className="palette-item editing">
        <input
          autoFocus
          type="text"
          defaultValue={saved.name}
          onBlur={(e) => {
            const next = e.target.value.trim();
            if (next !== '') onRename(saved.id, next);
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') setEditing(false);
          }}
        />
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className="palette-item saved"
      style={isDragging ? { opacity: 0.4 } : undefined}
      title={`${saved.name} — a saved ${saved.widget.type}.\n\nDrag onto a column, or click to add.`}
      onClick={() => onAdd(saved)}
      {...listeners}
      {...attributes}
    >
      <div className="name">{saved.name}</div>
      <div className="type">{saved.widget.type}</div>
      <div className="saved-actions">
        <button
          className="ghost"
          title="Rename"
          onClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
        >
          ✎
        </button>
        <button
          className="ghost danger"
          title="Remove from panel"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(saved.id);
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
