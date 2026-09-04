import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { WidgetInstance } from '../model/types';
import { WIDGETS_BY_TYPE } from '../catalog/widgets';
import { missingRequiredFields } from '../model/validate';
import { useStore } from '../model/store';
import { WidgetList } from './WidgetList';

type Props = {
  widget: WidgetInstance;
  pageId: string;
  columnId: string;
};

export function WidgetCard({ widget, pageId, columnId }: Props) {
  const { state, dispatch } = useStore();
  const def = WIDGETS_BY_TYPE.get(widget.type);
  const missing = missingRequiredFields(widget);
  const selected = state.selectedWidgetId === widget.id;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: widget.id,
    data: { kind: 'widget', widgetId: widget.id },
  });

  const title = typeof widget.props['title'] === 'string' ? widget.props['title'] : '';

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
