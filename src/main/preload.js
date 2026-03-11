const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Project initialization
  selectFolder: () => ipcRenderer.invoke('select-folder'),

  // Version control
  createVersion: (commitMessage) => ipcRenderer.invoke('create-version', commitMessage),
  getCommits: () => ipcRenderer.invoke('get-commits'),
  restoreCommit: (commitHash) => ipcRenderer.invoke('restore-commit', commitHash),

  // Changed files
  getChangedFiles: () => ipcRenderer.invoke('get-changed-files'),
  getWorkingFileDiff: (filePath, fileStatus) => ipcRenderer.invoke('get-working-file-diff', filePath, fileStatus),
  onChangedFilesUpdated: (callback) => ipcRenderer.on('changed-files-updated', (_event, data) => callback(data)),
  offChangedFilesUpdated: () => ipcRenderer.removeAllListeners('changed-files-updated'),

  // Parsing
  parseCommit: (commitHash) => ipcRenderer.invoke('parse-commit', commitHash),

  // Window controls
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),

  // Menu
  getMenuLabels: () => ipcRenderer.invoke('get-menu-labels'),
  popupMenu: (menuLabel) => ipcRenderer.send('popup-menu', menuLabel),
});
