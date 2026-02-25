export function ChangesHistoryTabs({ activeTab, onTabChange }) {
  return (
    <div className="changes-history-tabs">
      <button
        className={`tab-button ${activeTab === 'changes' ? 'active' : ''}`}
        onClick={() => onTabChange('changes')}
      >
        Changes
      </button>
      <button
        className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
        onClick={() => onTabChange('history')}
      >
        History
      </button>
    </div>
  );
}
