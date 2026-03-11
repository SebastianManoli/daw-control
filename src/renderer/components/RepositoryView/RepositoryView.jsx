import { useState, useCallback, useRef, useEffect } from 'react';
import { useProject } from '../../context/ProjectContext';
import { ChangesHistoryTabs } from '../ChangesHistoryTabs';
import { ChangesList } from '../ChangesList';
import { HistoryList } from '../HistoryList';
import { CommitMessageForm } from '../CommitMessageForm';
import { DiffViewer } from '../DiffViewer';
import { CommitDetails } from '../CommitDetails';

const MIN_LEFT_WIDTH = 250;
const MAX_LEFT_WIDTH = 600;
const DEFAULT_LEFT_WIDTH = 350;

export function RepositoryView() {
  const [activeTab, setActiveTab] = useState('history');
  const [leftWidth, setLeftWidth] = useState(DEFAULT_LEFT_WIDTH);
  const isDragging = useRef(false);
  const { projectName, isProjectOpen, openProject } = useProject();

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging.current) return;
      const newWidth = Math.min(MAX_LEFT_WIDTH, Math.max(MIN_LEFT_WIDTH, e.clientX));
      setLeftWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <div
      className="repository-view"
      style={{ gridTemplateColumns: `${leftWidth}px 4px 1fr` }}
    >
      <div className="left-panel">
        <button className="toolbar-button" onClick={openProject}>
          <span className="toolbar-label">Current project</span>
          <span className="toolbar-value">
            {isProjectOpen ? projectName : 'Select a project'}
            <span className="dropdown-arrow">&#9662;</span>
          </span>
        </button>
        <ChangesHistoryTabs activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="left-panel-content">
          {activeTab === 'changes' ? <ChangesList /> : <HistoryList />}
        </div>
        {activeTab === 'changes' && <CommitMessageForm />}
      </div>

      <div className="panel-divider" onMouseDown={handleMouseDown} />

      <div className="right-panel">
        {activeTab === 'changes' ? <DiffViewer /> : <CommitDetails />}
      </div>
    </div>
  );
}
