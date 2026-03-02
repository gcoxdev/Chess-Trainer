import { useId } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';

export function CollapsiblePanel({
  title,
  collapsed,
  onToggle,
  children,
  as = 'section',
  headerActions = null
}) {
  const RootTag = as;
  const panelBodyId = useId();

  return (
    <RootTag className={`panel${collapsed ? ' is-collapsed' : ''}`}>
      <div className="panel-head">
        <h2 className="panel-title">{title}</h2>
        {headerActions ? <div className="panel-head-actions">{headerActions}</div> : null}
        <button
          type="button"
          className="panel-toggle"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
          aria-controls={panelBodyId}
        >
          <FontAwesomeIcon icon={collapsed ? faEye : faEyeSlash} />
        </button>
      </div>
      <div id={panelBodyId} hidden={collapsed}>
        {!collapsed ? children : null}
      </div>
    </RootTag>
  );
}
