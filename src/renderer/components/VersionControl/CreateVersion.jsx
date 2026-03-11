import { useState } from 'react';

export function CreateVersion({ onCreateVersion, disabled }) {
  const [message, setMessage] = useState('');

  const handleSubmit = () => {
    if (!message.trim()) return;
    onCreateVersion(message);
    setMessage('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div className="create-version">
      <input
        type="text"
        className="version-input"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="version description"
        disabled={disabled}
      />
      <button
        className="btn btn-primary"
        onClick={handleSubmit}
        disabled={disabled || !message.trim()}
      >
        Create Version
      </button>
    </div>
  );
}
