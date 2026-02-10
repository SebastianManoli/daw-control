const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Project initialization
  selectFolder: () => ipcRenderer.invoke('select-folder'),

  // Version control
  createVersion: (commitMessage) => ipcRenderer.invoke('create-version', commitMessage),
  getCommits: () => ipcRenderer.invoke('get-commits'),
  restoreCommit: (commitHash) => ipcRenderer.invoke('restore-commit', commitHash),

  // Parsing
  parseCommit: (commitHash) => ipcRenderer.invoke('parse-commit', commitHash),
});
