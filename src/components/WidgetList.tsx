import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { WidgetInstance } from '../model/types';
import { encodeListId } from '../model/dragIds';
import { WidgetCard } from './WidgetCard';

type Props = {
  widgets: WidgetInstance[];
  pageId: string;
  columnId: string;
  parentId: string | null;
  emptyHint: string;
};

/**
 * One sortable, droppable list of widgets — used for a column's top level and
 * for the children of each container widget.
 */
export function WidgetList({ widgets, pageId, columnId, parentId, emptyHint }: Props) {
  const listId = encodeListId({ pageId, columnId, parentId });
  const { setNodeRef, isOver } = useDroppable({ id: listId, data: { kind: 'list' } });

  return (
    <SortableContext
      id={listId}
      items={widgets.map((w) => w.id)}
      strategy={verticalListSortingStrategy}
    >
      <div ref={setNodeRef} className={`dropzone${isOver ? ' over' : ''}`}>
        {widgets.length === 0 ? (
          <div className="dropzone-hint">{emptyHint}</div>
        ) : (
          widgets.map((widget) => (
            <WidgetCard key={widget.id} widget={widget} pageId={pageId} columnId={columnId} />
          ))
        )}
      </div>
    </SortableContext>
  );
}
