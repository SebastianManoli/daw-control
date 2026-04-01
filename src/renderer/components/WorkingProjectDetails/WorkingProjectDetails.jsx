import { useProject } from '../../context/ProjectContext';
import { ProjectSnapshot } from '../ProjectSnapshot/ProjectSnapshot';

export function WorkingProjectDetails() {
  const { workingParsedData, workingParsedDataLoading } = useProject();

  return (
    <div className="working-project-details">
      <div className="commit-details-diff">
        <ProjectSnapshot parsedData={workingParsedData} isLoading={workingParsedDataLoading} />
      </div>
    </div>
  );
}
