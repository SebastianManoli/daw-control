function formatDate(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function CommitItem({ commit, onRestore, onClick }) {
  return (
    <div className="commit-item">
      <div
        className="commit-content"
        onClick={() => onClick?.(commit.hash)}
      >
        <div className="commit-message">{commit.message}</div>
        <div className="commit-meta">
          <span className="commit-hash">{commit.shortHash}</span>
          <span className="commit-author">{commit.author}</span>
          <span className="commit-date">{formatDate(commit.date)}</span>
        </div>
      </div>
      <div className="commit-actions">
        <button
          className="restore-btn"
          onClick={() => onRestore(commit.hash)}
        >
          Restore
        </button>
      </div>
    </div>
  );
}
