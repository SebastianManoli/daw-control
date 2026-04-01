import { useProject } from '../../context/ProjectContext';
import { ProjectSnapshot } from '../ProjectSnapshot/ProjectSnapshot';

export function CommitDetails() {
  const { selectedCommit, commits, parsedData, isLoading, restoreVersion } = useProject();

  const commit = commits.find((c) => c.hash === selectedCommit);

  if (!commit) {
    return (
      <div className="commit-details">
        <div className="commit-details-empty">
          <p>Select a commit to view details</p>
        </div>
      </div>
    );
  }

  return (
    <div className="commit-details">
      <div className="commit-details-header">
        <h2 className="commit-details-title">{commit.message}</h2>
        <div className="commit-details-info">
          <div className="commit-details-avatar">
            {commit.author?.charAt(0).toUpperCase()}
          </div>
          <span className="commit-details-author">{commit.author}</span>
          <span className="commit-details-hash">{commit.shortHash}</span>
        </div>
      </div>

      <div className="commit-details-diff">
        <ProjectSnapshot parsedData={parsedData} isLoading={isLoading} revertButton={
          <div className="revert-button">
            <button
              className="btn btn-secondary"
              onClick={() => restoreVersion(selectedCommit)}
              disabled={isLoading}
            >
              Revert
            </button>
          </div>
        } />
      </div>
    </div>
  );
}
