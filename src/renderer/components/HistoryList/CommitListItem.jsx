function formatRelativeDate(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getInitial(name) {
  if (!name) return '?';
  return name.charAt(0).toUpperCase();
}

export function CommitListItem({ commit, isSelected, onClick, onContextMenu }) {
  const handleContextMenu = (e) => {
    e.preventDefault();
    onContextMenu?.(commit.hash, { x: e.clientX, y: e.clientY });
  };

  return (
    <div
      className={`commit-list-item ${isSelected ? 'selected' : ''}`}
      onClick={() => onClick?.(commit.hash)}
      onContextMenu={handleContextMenu}
    >
      <div className="commit-list-avatar">
        {getInitial(commit.author)}
      </div>
      <div className="commit-list-body">
        <div className="commit-list-message">{commit.message}</div>
        <div className="commit-list-meta">
          <span className="commit-list-author">{commit.author}</span>
          <span className="commit-list-date">{formatRelativeDate(commit.date)}</span>
        </div>
      </div>
    </div>
  );
}
