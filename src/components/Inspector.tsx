import type { Page, PageWidth } from '../model/types';
import { SHARED_FIELDS } from '../catalog/types';
import { getWidget } from '../model/tree';
import { useStore } from '../model/store';
import { slugify } from '../export/toYaml';
import { DEFAULT_HINT_PX, estimateHeight } from '../model/size';
import { suggestName } from '../model/savedWidgets';
import { FieldRenderer } from './fields/FieldRenderer';

const WIDTHS: PageWidth[] = ['default', 'slim', 'wide'];

/** Shows the selected widget's form, or the page's own settings when nothing is selected. */
export function Inspector({ page }: { page: Page }) {
  const { state } = useStore();
  const widget = state.selectedWidgetId ? getWidget(state.config, state.selectedWidgetId) : undefined;
  return widget ? <WidgetForm widgetId={widget.id} /> : <PageForm page={page} />;
}

function WidgetForm({ widgetId }: { widgetId: string }) {
  const { state, dispatch, catalog, saved, saveWidget } = useStore();
  const widget = getWidget(state.config, widgetId);
  if (!widget) return null;

  const def = catalog.byType.get(widget.type);
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

      {def && def.extraFields.length > 0 && (
        <details className="advanced">
          <summary>
            {def.extraFields.length} more propert{def.extraFields.length === 1 ? 'y' : 'ies'} your
            Glance accepts
          </summary>
          <p className="desc">
            Read from your Glance source, so these carry no descriptions or defaults. Anything left
            empty is omitted and Glance applies its own default.
          </p>
          {def.extraFields.map((field) => (
            <FieldRenderer
              key={field.key}
              field={field}
              value={widget.props[field.key]}
              onChange={(v) => set(field.key, v)}
            />
          ))}
        </details>
      )}

      {def && !def.available && (
        <p className="warn-text">
          Your uploaded catalog has no <code>{widget.type}</code>. Glance would reject this config
          with <code>unknown widget type</code>.
        </p>
      )}

      <HeightField widgetId={widgetId} />

      <div className="field">
        <button
          onClick={() => saveWidget(widget, suggestName(widget, def?.label))}
          title="Keep this widget, as configured, in the side panel so it can be placed again"
        >
          Save to panel
        </button>
        {saved.some((entry) => entry.widget.type === widget.type) && (
          <span className="help">
            Saved widgets live under <strong>My widgets</strong> in the panel. Saving again adds a
            separate copy.
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Only offered for widgets whose height cannot be derived from config — the
 * ones rendering content Glance itself only discovers at request time.
 */
function HeightField({ widgetId }: { widgetId: string }) {
  const { state, dispatch } = useStore();
  const widget = getWidget(state.config, widgetId);
  if (!widget) return null;

  const size = estimateHeight(widget);
  if (size.basis !== 'hint') return null;

  return (
    <div className="field">
      <label>Approximate height</label>
      <input
        type="number"
        min={1}
        step={10}
        value={widget.heightHint ?? DEFAULT_HINT_PX}
        onChange={(e) => {
          const px = Number(e.target.value);
          dispatch({
            type: 'set-height-hint',
            widgetId,
            px: e.target.value === '' || !Number.isFinite(px) ? undefined : px,
          });
        }}
      />
      <span className="help">
        This widget renders whatever its source returns, so its size cannot be worked out from the
        config. Set roughly how tall it is on your dashboard. Layout only — never exported.
      </span>
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
