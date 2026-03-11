export function ChangedFileListItem({ file, isSelected, onClick }) {
  const statusIcons = {
    added: '+',
    modified: '~',
    deleted: '-',
  };

  const statusClasses = {
    added: 'status-added',
    modified: 'status-modified',
    deleted: 'status-deleted',
  };

  return (
    <div
      className={`changed-file-item ${isSelected ? 'selected' : ''}`}
      onClick={() => onClick?.(file)}
    >
      <label className="file-checkbox">
        <input type="checkbox" defaultChecked />
      </label>
      <span className={`file-status ${statusClasses[file.status]}`}>
        {statusIcons[file.status]}
      </span>
      <span className="file-path">{file.path}</span>
    </div>
  );
}
