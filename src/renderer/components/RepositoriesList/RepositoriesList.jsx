import { useProject } from '../../context/ProjectContext';
import { RepositoryListItem } from './RepositoryListItem';

export function RepositoriesList() {
  const { projectName, isProjectOpen } = useProject();

  const repos = isProjectOpen
    ? [{ name: projectName, path: '~/Projects/' + projectName }]
    : [];

  return (
    <div className="repositories-list">
      <div className="repositories-header">Repositories</div>
      {repos.length === 0 ? (
        <div className="no-repos">No repositories</div>
      ) : (
        repos.map((repo) => (
          <RepositoryListItem
            key={repo.name}
            name={repo.name}
            path={repo.path}
            isSelected={true}
            onClick={() => {}}
          />
        ))
      )}
    </div>
  );
}
