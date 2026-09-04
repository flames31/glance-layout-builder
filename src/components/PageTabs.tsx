import { useStore } from '../model/store';
import { pageIssues } from '../model/validate';

export function PageTabs() {
  const { state, dispatch } = useStore();

  return (
    <div className="tabs">
      {state.config.pages.map((page) => {
        const issues = pageIssues(page, state.config.pages);
        const active = page.id === state.activePageId;
        return (
          <button
            key={page.id}
            className={`tab${active ? ' active' : ''}`}
            onClick={() => dispatch({ type: 'select-page', pageId: page.id })}
          >
            {page.name || <em>untitled</em>}
            {issues.length > 0 && <span className="badge" title={`${issues.length} issue(s)`}>●</span>}
          </button>
        );
      })}
      <button className="ghost" title="Add page" onClick={() => dispatch({ type: 'add-page' })}>
        +
      </button>
    </div>
  );
}
