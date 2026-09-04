import type { Page } from '../model/types';
import { useStore } from '../model/store';
import { canAddColumn, canRemoveColumn, canSetColumnSize } from '../model/validate';
import { WidgetList } from './WidgetList';

/**
 * The page rendered as its real column layout. Column controls are disabled
 * whenever the change would break one of Glance's layout rules, so an invalid
 * arrangement cannot be built in the first place.
 */
export function Canvas({ page }: { page: Page }) {
  const { dispatch } = useStore();

  return (
    <div className="columns" onClick={() => dispatch({ type: 'select-widget', widgetId: null })}>
      {page.columns.map((column) => {
        const otherSize = column.size === 'small' ? 'full' : 'small';
        return (
          <div className={`column ${column.size}`} key={column.id}>
            <div className="column-head">
              <span>{column.size}</span>
              <span className="spacer" />
              <button
                title={`Change to ${otherSize}`}
                disabled={!canSetColumnSize(page, column.id, otherSize)}
                onClick={() =>
                  dispatch({
                    type: 'set-column-size',
                    pageId: page.id,
                    columnId: column.id,
                    size: otherSize,
                  })
                }
              >
                → {otherSize}
              </button>
              <button
                className="danger"
                title="Remove column"
                disabled={!canRemoveColumn(page, column.id)}
                onClick={() =>
                  dispatch({ type: 'remove-column', pageId: page.id, columnId: column.id })
                }
              >
                ✕
              </button>
            </div>

            <WidgetList
              widgets={column.widgets}
              pageId={page.id}
              columnId={column.id}
              parentId={null}
              emptyHint="Drop a widget here"
            />
          </div>
        );
      })}

      <div className="column small" style={{ minHeight: 0, background: 'transparent', border: 'none' }}>
        <button
          disabled={!canAddColumn(page, 'small')}
          title={
            canAddColumn(page, 'small')
              ? 'Add a small column'
              : 'Glance allows at most 3 columns per page (2 on a slim page).'
          }
          onClick={() => dispatch({ type: 'add-column', pageId: page.id, size: 'small' })}
        >
          + small column
        </button>
        <button
          disabled={!canAddColumn(page, 'full')}
          title={
            canAddColumn(page, 'full')
              ? 'Add a full-width column'
              : 'A page can have at most 2 full-width columns.'
          }
          onClick={() => dispatch({ type: 'add-column', pageId: page.id, size: 'full' })}
        >
          + full column
        </button>
      </div>
    </div>
  );
}
