const { ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { initializeGitRepository, createCommit } = require('./git-handler');

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
}

module.exports = { registerIpcHandlers };
