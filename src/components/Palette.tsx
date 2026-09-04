import { useMemo, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { WidgetCategory, WidgetDef } from '../catalog/types';
import { WIDGETS } from '../catalog/widgets';
import { encodeNewId } from '../model/dragIds';

const ORDER: WidgetCategory[] = ['Feeds', 'Monitoring', 'Media', 'Utility', 'Layout', 'Advanced'];

export function Palette({ onAdd }: { onAdd: (type: string) => void }) {
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = WIDGETS.filter(
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
  }, [query]);

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
      {groups.length === 0 && <p className="palette-empty">No widget matches “{query}”.</p>}
      {groups.map((group) => (
        <div className="palette-group" key={group.category}>
          <h3>{group.category}</h3>
          {group.widgets.map((widget) => (
            <PaletteItem key={widget.type} widget={widget} onAdd={onAdd} />
          ))}
        </div>
      ))}
    </>
  );
}

function PaletteItem({ widget, onAdd }: { widget: WidgetDef; onAdd: (type: string) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: encodeNewId(widget.type),
    data: { kind: 'new', widgetType: widget.type },
  });

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
