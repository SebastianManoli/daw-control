import { useProject } from '../../context/ProjectContext';

export function AppTitleBar() {
  const { projectName, isProjectOpen, openProject } = useProject();

  return (
    <div className="app-title-bar">
      <button className="toolbar-button" onClick={openProject}>
        <span className="toolbar-label">Current project</span>
        <span className="toolbar-value">{isProjectOpen ? projectName : 'Select a project'}</span>
        <span className="dropdown-arrow">&#9662;</span>
      </button>
    </div>
  );
}
