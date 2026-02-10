import { CommitItem } from './CommitItem';

export function CommitList({ commits, onRestore, onCommitClick }) {
  if (commits.length === 0) {
    return (
      <div className="commits-list">
        <div className="no-commits">No versions yet</div>
      </div>
    );
  }

  return (
    <div className="commits-list">
      {commits.map((commit) => (
        <CommitItem
          key={commit.hash}
          commit={commit}
          onRestore={onRestore}
          onClick={onCommitClick}
        />
      ))}
    </div>
  );
}
