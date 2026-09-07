import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { WidgetInstance } from '../model/types';
import { missingRequiredFields } from '../model/validate';
import { useStore } from '../model/store';
import { estimateHeight } from '../model/size';
import { WidgetList } from './WidgetList';

type Props = {
  widget: WidgetInstance;
  pageId: string;
  columnId: string;
};

export function WidgetCard({ widget, pageId, columnId }: Props) {
  const { state, dispatch, catalog } = useStore();
  const def = catalog.byType.get(widget.type);
  const missing = missingRequiredFields(widget);
  const selected = state.selectedWidgetId === widget.id;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: widget.id,
    data: { kind: 'widget', widgetId: widget.id },
  });

  const title = typeof widget.props['title'] === 'string' ? widget.props['title'] : '';

  // Containers size themselves to the widgets dropped inside them; everything
  // else gets a body scaled to the height it will occupy on the dashboard.
  const size = estimateHeight(widget);
  const bodyHeight = def?.container ? undefined : `calc(${size.px} * var(--px-scale))`;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={[
        'widget-card',
        selected ? 'selected' : '',
        missing.length > 0 ? 'invalid' : '',
        isDragging ? 'dragging' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={(e) => {
        e.stopPropagation();
        dispatch({ type: 'select-widget', widgetId: widget.id });
      }}
    >
      <div className="row">
        <span className="grip" {...listeners} {...attributes} title="Drag to move">
          ⠿
        </span>
        <span className="label">
          {title || def?.label || widget.type}
          {title && <span className="sub">{widget.type}</span>}
        </span>
        {missing.length > 0 && <span className="warn" title={`Missing: ${missing.join(', ')}`}>!</span>}
        <span className="actions">
          <button
            className="ghost"
            title="Duplicate"
            onClick={(e) => {
              e.stopPropagation();
              dispatch({ type: 'duplicate-widget', widgetId: widget.id });
            }}
          >
            ⧉
          </button>
          <button
            className="ghost danger"
            title="Remove"
            onClick={(e) => {
              e.stopPropagation();
              dispatch({ type: 'remove-widget', widgetId: widget.id });
            }}
          >
            ✕
          </button>
        </span>
      </div>

      {!def?.container && (
        <div className="card-body" style={{ height: bodyHeight }}>
          <span className="card-size">
            {widget.type} · {size.basis === 'exact' ? '' : '~'}
            {size.px}px
          </span>
        </div>
      )}

      {def?.container && (
        <div className="container-body">
          <WidgetList
            widgets={widget.children ?? []}
            pageId={pageId}
            columnId={columnId}
            parentId={widget.id}
            emptyHint="Drop widgets here"
          />
        </div>
      )}
    </div>
  );
}
