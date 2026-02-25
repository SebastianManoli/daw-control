import { ChangedFileListItem } from './ChangedFileListItem';

const PLACEHOLDER_FILES = [
  { path: 'My Song.als', status: 'modified' },
  { path: 'Samples/kick.wav', status: 'added' },
  { path: 'Presets/old-synth.adv', status: 'deleted' },
];

export function ChangesList() {
  return (
    <div className="changes-list">
      {PLACEHOLDER_FILES.map((file) => (
        <ChangedFileListItem key={file.path} file={file} />
      ))}
    </div>
  );
}
