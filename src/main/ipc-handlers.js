const { ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { initializeGitRepository, createCommit, getCommitHistory, restoreCommit } = require('./git-handler');

// Store the current project path
let currentProjectPath = null;

/**
 * Register all IPC handlers for communication between main and renderer processes
 */
function registerIpcHandlers() {
  // Handle folder selection for project initialization
  ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const folderPath = result.filePaths[0];
      console.log('Selected folder:', folderPath);

      try {
        // Read directory contents
        const files = await fs.readdir(folderPath);

        // Check if any file has .als extension
        const hasAlsFile = files.some(file => path.extname(file).toLowerCase() === '.als');

        if (hasAlsFile) {
          console.log("Folder contains Ableton Live Set (.als)");

          // Initialize git repository
          const gitResult = await initializeGitRepository(folderPath);

          if (gitResult.success) {
            // Store the project path for future operations
            currentProjectPath = folderPath;
            return { success: true, path: folderPath };
          } else {
            return { success: false, error: gitResult.error };
          }
        } else {
          // Show error dialog to user
          dialog.showErrorBox(
            'No Ableton Live Set Found',
            'The selected folder does not contain any .als files. Please select a folder with an Ableton Live Set file.'
          );
          return { success: false, error: 'No .als files found' };
        }
      } catch (error) {
        console.error('Error reading folder:', error);
        dialog.showErrorBox('Error', 'Failed to read folder contents.');
        return { success: false, error: error.message };
      }
    }
    return null;
  });

  // Handle creating a new version (commit)
  ipcMain.handle('create-version', async (event, commitMessage) => {
    // Check if a project is open
    if (!currentProjectPath) {
      dialog.showErrorBox('No Project Open', 'Please initialize a project first before creating a version.');
      return { success: false, error: 'No project initialized' };
    }

    // Validate commit message
    if (!commitMessage || commitMessage.trim() === '') {
      dialog.showErrorBox('Invalid Message', 'Please enter a commit message.');
      return { success: false, error: 'Empty commit message' };
    }

    // Create the commit
    const commitResult = await createCommit(currentProjectPath, commitMessage);

    if (commitResult.success) {
      dialog.showMessageBox({
        type: 'info',
        title: 'Version Created',
        message: 'New version created successfully!',
        detail: `Commit message: ${commitMessage}`
      });
    } else {
      dialog.showErrorBox('Commit Failed', `Failed to create version: ${commitResult.error}`);
    }

    return commitResult;
  });

  // Handle getting commit history
  ipcMain.handle('get-commits', async () => {
    if (!currentProjectPath) {
      return { success: false, error: 'No project opened', commits: [] };
    }

    return await getCommitHistory(currentProjectPath);
  });

  // Handle restoring to a specific commit
  ipcMain.handle('restore-commit', async (event, commitHash) => {
    if (!currentProjectPath) {
      dialog.showErrorBox('No Project Open', 'Please open a project first.');
      return { success: false, error: 'No project opened' };
    }

    // Show confirmation dialog
    const result = await dialog.showMessageBox({
      type: 'warning',
      buttons: ['Cancel', 'Restore'],
      defaultId: 0,
      cancelId: 0,
      title: 'Restore Version',
      message: 'Are you sure you want to restore to this version?',
      detail: 'This will restore all project files to the selected version and create a new commit. Your current work must be committed first.'
    });

    if (result.response === 0) {
      // User clicked Cancel
      return { success: false, error: 'Cancelled by user' };
    }

    // Perform the restore
    const restoreResult = await restoreCommit(currentProjectPath, commitHash);

    if (restoreResult.success) {
      dialog.showMessageBox({
        type: 'info',
        title: 'Version Restored',
        message: 'Project restored successfully!',
        detail: `Your project has been restored to version ${commitHash.substring(0, 7)} and a new commit has been created.`
      });
    } else {
      dialog.showErrorBox('Restore Failed', `Failed to restore: ${restoreResult.error}`);
    }

    return restoreResult;
  });
}

module.exports = { registerIpcHandlers };
