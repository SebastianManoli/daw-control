const { ipcRenderer } = require('electron');

// Initialize Project button handler
document.getElementById('selectFolderBtn').addEventListener('click', async () => {
  const result = await ipcRenderer.invoke('select-folder');

  if (result && result.success) {
    console.log('Selected folder:', result.path);
    // TODO: Continue with project initialization
  } else if (result && !result.success) {
    console.log('Error:', result.error);
  }
});

// Create Version button handler (placeholder for future functionality)
document.getElementById('createVersionBtn').addEventListener('click', async () => {
  const result = await ipcRenderer.invoke('create-version');

  if (result && result.success) {
    console.log('Commit Created');
    // TODO: Render Commit in app
  } else if (result && !result.success) {
    console.log('Error:', result.error);
  }
  
});
