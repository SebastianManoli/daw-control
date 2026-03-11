import { useState } from 'react';
import { useProject } from '../../context/ProjectContext';

export function CommitMessageForm() {
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const { createVersion, isProjectOpen, isLoading } = useProject();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!summary.trim()) return;

    const message = description.trim()
      ? `${summary.trim()}\n\n${description.trim()}`
      : summary.trim();

    const result = await createVersion(message);
    if (result?.success) {
      setSummary('');
      setDescription('');
    }
  };

  return (
    <form className="commit-message-form" onSubmit={handleSubmit}>
      <input
        type="text"
        className="commit-summary-input"
        placeholder="Summary (required)"
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        disabled={!isProjectOpen || isLoading}
      />
      <textarea
        className="commit-description-input"
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
        disabled={!isProjectOpen || isLoading}
      />
      <button
        type="submit"
        className="btn btn-primary commit-submit-btn"
        disabled={!isProjectOpen || isLoading || !summary.trim()}
      >
        Commit to main
      </button>
    </form>
  );
}
