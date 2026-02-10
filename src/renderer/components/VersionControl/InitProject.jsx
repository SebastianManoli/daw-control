export function InitProject({ onSelectFolder, isProjectOpen }) {
  return (
    <button
      className="btn btn-secondary"
      onClick={onSelectFolder}
    >
      {isProjectOpen ? 'Change Project' : 'Initialise Project'}
    </button>
  );
}
