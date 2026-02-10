export function Header({ projectName }) {
  return (
    <header className="header">
      <h1>DAW-Control</h1>
      <div className="project-name">{projectName || 'No project open'}</div>
    </header>
  );
}
