export function CollapsiblePanel({ title, collapsed, onToggle, children, as = 'section' }) {
  const RootTag = as;

  return (
    <RootTag className={`panel${collapsed ? ' is-collapsed' : ''}`}>
      <div className="panel-head">
        <h2 className="panel-title">{title}</h2>
        <button
          type="button"
          className="panel-toggle"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
        >
          {collapsed ? 'Show' : 'Hide'}
        </button>
      </div>
      {!collapsed ? children : null}
    </RootTag>
  );
}
