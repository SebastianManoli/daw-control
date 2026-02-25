export function ChangedFileListItem({ file }) {
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
    <div className="changed-file-item">
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
