import { useProject } from '../../context/ProjectContext';
import { ChangedFileListItem } from './ChangedFileListItem';

export function ChangesList() {
  const { changedFiles, selectedChangedFilePath, selectChangedFile } = useProject();

  if (changedFiles.length === 0) {
    return (
      <div className="changes-list">
        <div className="no-commits">No changes detected</div>
      </div>
    );
  }

  return (
    <div className="changes-list">
      {changedFiles.map((file) => (
        <ChangedFileListItem
          key={file.path}
          file={file}
          isSelected={selectedChangedFilePath === file.path}
          onClick={selectChangedFile}
        />
      ))}
    </div>
  );
}
