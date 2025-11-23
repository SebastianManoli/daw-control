const { ipcRenderer } = require('electron');
const path = require('path');

/**
 * Update the project name display
 * @param {string} folderPath - The full project path
 */
function updateProjectName(folderPath) {
  const projectNameEl = document.getElementById('project-name');
  if (folderPath) {
    const folderName = path.basename(folderPath);
    projectNameEl.textContent = folderName;
  } else {
    projectNameEl.textContent = '';
  }
}

/**
 * Handle restore button click
 * @param {Event} event - Click event
 */
async function handleRestoreClick(event) {
  const commitHash = event.target.dataset.commitHash;

  if (!commitHash) {
    console.error('No commit hash found');
    return;
  }

  // Call IPC to restore commit
  const result = await ipcRenderer.invoke('restore-commit', commitHash);

  if (result && result.success) {
    console.log('Restored to commit:', commitHash);
    // Reload commits to show the new "Restored to..." commit
    await loadCommits();
  } else if (result && !result.success) {
    console.log('Restore failed:', result.error);
  }
}

/**
 * Fetch and display commits from the git repository
 */
async function loadCommits() {
  const result = await ipcRenderer.invoke('get-commits');

  const commitsList = document.getElementById('commits-list');

  if (result && result.success && result.commits && result.commits.length > 0) {
    // Clear existing commits
    commitsList.innerHTML = '';

    // Display each commit
    result.commits.forEach(commit => {
      const commitItem = document.createElement('div');
      commitItem.className = 'commit-item';

      // Commit content (message and metadata)
      const commitContent = document.createElement('div');
      commitContent.className = 'commit-content';

      const commitMessage = document.createElement('div');
      commitMessage.className = 'commit-message';
      commitMessage.textContent = commit.message;

      const commitMeta = document.createElement('div');
      commitMeta.className = 'commit-meta';

      const commitHash = document.createElement('span');
      commitHash.className = 'commit-hash';
      commitHash.textContent = commit.shortHash;

      const commitAuthor = document.createElement('span');
      commitAuthor.className = 'commit-author';
      commitAuthor.textContent = commit.author;

      const commitDate = document.createElement('span');
      commitDate.className = 'commit-date';
      const date = new Date(commit.date);
      commitDate.textContent = date.toLocaleString();

      commitMeta.appendChild(commitHash);
      commitMeta.appendChild(commitAuthor);
      commitMeta.appendChild(commitDate);

      commitContent.appendChild(commitMessage);
      commitContent.appendChild(commitMeta);

      // Commit actions (restore button)
      const commitActions = document.createElement('div');
      commitActions.className = 'commit-actions';

      const restoreBtn = document.createElement('button');
      restoreBtn.className = 'restore-btn';
      restoreBtn.textContent = 'Restore';
      restoreBtn.dataset.commitHash = commit.hash;
      restoreBtn.addEventListener('click', handleRestoreClick);

      commitActions.appendChild(restoreBtn);

      commitItem.appendChild(commitContent);
      commitItem.appendChild(commitActions);

      commitsList.appendChild(commitItem);
    });
  } else {
    // No commits or error
    commitsList.innerHTML = '<div class="no-commits">No version history yet. Create your first version!</div>';
  }
}

// Initialize Project button handler
document.getElementById('selectFolderBtn').addEventListener('click', async () => {
  const result = await ipcRenderer.invoke('select-folder');

  if (result && result.success) {
    console.log('Selected folder:', result.path);
    // Update project name display
    updateProjectName(result.path);
    // Load commits after project initialization
    await loadCommits();
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
    // Visual feedback instead of alert
    commitMessageInput.placeholder = 'Please enter a message!';
    commitMessageInput.focus();
    return;
  }

  // Send commit message to main process
  const result = await ipcRenderer.invoke('create-version', commitMessage);

  if (result && result.success) {
    console.log('Commit Created:', commitMessage);
    // Clear the input field after successful commit
    commitMessageInput.value = '';
    // Reload commits to show the new commit
    await loadCommits();
  } else if (result && !result.success) {
    console.log('Error:', result.error);
  }
});
