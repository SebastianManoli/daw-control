import { useState, useEffect, useCallback } from 'react';
import { useProject } from '../../context/ProjectContext';
import { CommitListItem } from './CommitListItem';

export function HistoryList() {
  const { commits, selectedCommit, parseVersion, restoreVersion } = useProject();
  const [contextMenu, setContextMenu] = useState(null);

  const handleContextMenu = useCallback((hash, pos) => {
    setContextMenu({ hash, x: pos.x, y: pos.y });
  }, []);

  const handleRevert = useCallback(() => {
    if (contextMenu) {
      restoreVersion(contextMenu.hash);
      setContextMenu(null);
    }
  }, [contextMenu, restoreVersion]);

  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  if (commits.length === 0) {
    return (
      <div className="history-list">
        <div className="no-commits">No versions yet</div>
      </div>
    );
  }

  return (
    <div className="history-list">
      {commits.map((commit) => (
        <CommitListItem
          key={commit.hash}
          commit={commit}
          isSelected={selectedCommit === commit.hash}
          onClick={parseVersion}
          onContextMenu={handleContextMenu}
        />
      ))}

      {contextMenu && (
        <div
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button className="context-menu-item" onClick={handleRevert}>
            Revert to this version
          </button>
        </div>
      )}
    </div>
  );
}
