import { Header, ControlPanel, MainContent } from './components/Layout';
import { InitProject, CreateVersion, CommitList } from './components/VersionControl';
import { useProject } from './context/ProjectContext';

function App() {
  const {
    projectName,
    commits,
    isProjectOpen,
    isLoading,
    openProject,
    createVersion,
    restoreVersion,
    parseVersion,
  } = useProject();

  return (
    <div className="app">
      <Header projectName={projectName} />

      <ControlPanel>
        <InitProject
          onSelectFolder={openProject}
          isProjectOpen={isProjectOpen}
        />
        <CreateVersion
          onCreateVersion={createVersion}
          disabled={!isProjectOpen || isLoading}
        />
      </ControlPanel>

      <MainContent>
        <section className="version-history">
          <h2>Version History</h2>
          <CommitList
            commits={commits}
            onRestore={restoreVersion}
            onCommitClick={parseVersion}
          />
        </section>
      </MainContent>
    </div>
  );
}

export default App;
