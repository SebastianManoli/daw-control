import { useProject } from '../../context/ProjectContext';

export function DiffViewer() {
  const {
    selectedChangedFilePath,
    workingFileDiff,
    workingFileDiffLoading,
    workingFileDiffError,
  } = useProject();

  if (!selectedChangedFilePath) {
    return (
      <div className="diff-viewer">
        <div className="diff-placeholder">
          <span className="diff-placeholder-icon">&#128196;</span>
          <p>Select a file to view changes</p>
        </div>
      </div>
    );
  }

  if (workingFileDiffLoading) {
    return (
      <div className="diff-viewer">
        <div className="diff-placeholder">
          <p>Loading file diff...</p>
        </div>
      </div>
    );
  }

  if (workingFileDiffError) {
    return (
      <div className="diff-viewer">
        <div className="diff-placeholder">
          <p>{workingFileDiffError}</p>
        </div>
      </div>
    );
  }

  if (!workingFileDiff?.isAlsFile) {
    return (
      <div className="diff-viewer">
        <div className="diff-placeholder">
          <p>Diff preview is currently available for .als files only</p>
        </div>
      </div>
    );
  }

  const sections = workingFileDiff?.diff?.sections || [];
  const summary = workingFileDiff?.diff?.summary;

  if (sections.length === 0) {
    return (
      <div className="diff-viewer">
        <div className="diff-placeholder">
          <p>No semantic changes detected</p>
        </div>
      </div>
    );
  }

  return (
    <div className="diff-viewer">
      <div className="diff-content">
        <div className="diff-header">
          <div className="diff-file-name">{workingFileDiff.filePath}</div>
          {summary && (
            <div className="diff-summary">
              <span className="diff-summary-added">+{summary.added}</span>
              <span className="diff-summary-removed">-{summary.removed}</span>
              <span className="diff-summary-modified">~{summary.modified}</span>
            </div>
          )}
        </div>

        {sections.map((section) => (
          <div key={section.kind} className={`diff-section diff-section--${section.kind}`}>
            <div className="diff-section-title">{section.title}</div>
            <div className="diff-section-list">
              {section.items.map((item, index) => (
                <div key={`${section.kind}-${index}`} className="diff-item">
                  <div className="diff-item-label">{item.label}</div>
                  {item.detail && <div className="diff-item-detail">{item.detail}</div>}
                  {(item.before || item.after) && (
                    <div className="diff-item-values">
                      {item.before && <span className="diff-before">{item.before}</span>}
                      {item.before && item.after && <span className="diff-arrow">→</span>}
                      {item.after && <span className="diff-after">{item.after}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
