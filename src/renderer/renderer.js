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

// Create Version button handler
document.getElementById('createVersionBtn').addEventListener('click', async () => {
  // Get commit message from input field
  const commitMessageInput = document.getElementById('commit-message');
  const commitMessage = commitMessageInput.value.trim();

  // Validate that message is not empty
  if (!commitMessage) {
    alert('Please enter a version description');
    commitMessageInput.focus();
    return;
  }

  // Send commit message to main process
  const result = await ipcRenderer.invoke('create-version', commitMessage);

  if (result && result.success) {
    console.log('Commit Created:', commitMessage);
    // Clear the input field after successful commit
    commitMessageInput.value = '';
  } else if (result && !result.success) {
    console.log('Error:', result.error);
  }
});
