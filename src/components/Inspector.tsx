import type { Page, PageWidth } from '../model/types';
import { SHARED_FIELDS } from '../catalog/types';
import { WIDGETS_BY_TYPE } from '../catalog/widgets';
import { getWidget } from '../model/tree';
import { useStore } from '../model/store';
import { slugify } from '../export/toYaml';
import { FieldRenderer } from './fields/FieldRenderer';

const WIDTHS: PageWidth[] = ['default', 'slim', 'wide'];

/** Shows the selected widget's form, or the page's own settings when nothing is selected. */
export function Inspector({ page }: { page: Page }) {
  const { state } = useStore();
  const widget = state.selectedWidgetId ? getWidget(state.config, state.selectedWidgetId) : undefined;
  return widget ? <WidgetForm widgetId={widget.id} /> : <PageForm page={page} />;
}

function WidgetForm({ widgetId }: { widgetId: string }) {
  const { state, dispatch } = useStore();
  const widget = getWidget(state.config, widgetId);
  if (!widget) return null;

  const def = WIDGETS_BY_TYPE.get(widget.type);
  const set = (key: string, value: unknown) => dispatch({ type: 'set-prop', widgetId, key, value });

  return (
    <div className="inspector">
      <h2>{def?.label ?? widget.type}</h2>
      <p className="desc">{def?.description}</p>

      {def?.fields.map((field) => (
        <FieldRenderer
          key={field.key}
          field={field}
          value={widget.props[field.key]}
          onChange={(v) => set(field.key, v)}
        />
      ))}

      {def?.container && (
        <p className="desc">
          Drag widgets onto this {def.label.toLowerCase()} in the canvas to nest them.
        </p>
      )}

      {SHARED_FIELDS.map((field) => (
        <FieldRenderer
          key={field.key}
          field={field}
          value={widget.props[field.key]}
          onChange={(v) => set(field.key, v)}
        />
      ))}
    </div>
  );
}

function PageForm({ page }: { page: Page }) {
  const { state, dispatch } = useStore();
  const patch = (p: Partial<Omit<Page, 'id' | 'columns'>>) =>
    dispatch({ type: 'update-page', pageId: page.id, patch: p });

  return (
    <div className="inspector">
      <h2>Page settings</h2>
      <p className="desc">Select a widget in the canvas to edit it.</p>

      <div className="field required">
        <label>Name</label>
        <input type="text" value={page.name} onChange={(e) => patch({ name: e.target.value })} />
      </div>

      <div className="field">
        <label>Slug</label>
        <input
          type="text"
          value={page.slug ?? ''}
          placeholder={slugify(page.name) || 'derived from name'}
          onChange={(e) => patch({ slug: e.target.value || undefined })}
        />
        <span className="help">Leave empty to derive it from the name.</span>
      </div>

      <div className="field">
        <label>Width</label>
        <select
          value={page.width ?? 'default'}
          onChange={(e) => patch({ width: e.target.value as PageWidth })}
        >
          {WIDTHS.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
        <span className="help">A slim page is limited to 2 columns.</span>
      </div>

      <div className="field checkbox">
        <input
          id="center-vertically"
          type="checkbox"
          checked={page.centerVertically === true}
          onChange={(e) => patch({ centerVertically: e.target.checked || undefined })}
        />
        <label htmlFor="center-vertically">Center vertically</label>
      </div>

      <div className="field checkbox">
        <input
          id="hide-desktop-nav"
          type="checkbox"
          checked={page.hideDesktopNavigation === true}
          onChange={(e) => patch({ hideDesktopNavigation: e.target.checked || undefined })}
        />
        <label htmlFor="hide-desktop-nav">Hide desktop navigation</label>
      </div>

      <button
        className="danger"
        disabled={state.config.pages.length <= 1}
        title={state.config.pages.length <= 1 ? 'Glance requires at least one page.' : 'Delete this page'}
        onClick={() => dispatch({ type: 'remove-page', pageId: page.id })}
      >
        Delete page
      </button>
    </div>
  );
}
