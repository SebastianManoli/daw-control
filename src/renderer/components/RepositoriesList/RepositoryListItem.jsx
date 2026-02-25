export function RepositoryListItem({ name, path, isSelected, onClick }) {
  return (
    <div
      className={`repository-list-item ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
    >
      <div className="repo-item-name">{name}</div>
      <div className="repo-item-path">{path}</div>
    </div>
  );
}
