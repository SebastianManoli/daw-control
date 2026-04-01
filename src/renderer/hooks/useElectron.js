/**
 * Hook to access Electron IPC methods exposed via preload script
 * Returns the electronAPI object or null if not running in Electron
 */
export function useElectron() {
  const api = window.electronAPI;
  console.log('electronAPI available:', !!api);

  if (!api) {
    console.warn('electronAPI not available - not running in Electron?');
    return {
      selectFolder: async () => ({ success: false, error: 'Not in Electron' }),
      createVersion: async () => ({ success: false, error: 'Not in Electron' }),
      getCommits: async () => ({ success: false, commits: [], error: 'Not in Electron' }),
      restoreCommit: async () => ({ success: false, error: 'Not in Electron' }),
      parseCommit: async () => ({ success: false, error: 'Not in Electron' }),
      parseWorkingFile: async () => ({ success: false, error: 'Not in Electron' }),
      getChangedFiles: async () => ({ success: true, files: [] }),
      getWorkingFileDiff: async () => ({ success: false, error: 'Not in Electron' }),
      onChangedFilesUpdated: () => {},
      offChangedFilesUpdated: () => {},
      isElectron: false,
    };
  }

  return {
    selectFolder: api.selectFolder,
    createVersion: api.createVersion,
    getCommits: api.getCommits,
    restoreCommit: api.restoreCommit,
    parseCommit: api.parseCommit,
    parseWorkingFile: api.parseWorkingFile,
    getChangedFiles: api.getChangedFiles,
    getWorkingFileDiff: api.getWorkingFileDiff,
    onChangedFilesUpdated: api.onChangedFilesUpdated,
    offChangedFilesUpdated: api.offChangedFilesUpdated,
    isElectron: true,
  };
}
