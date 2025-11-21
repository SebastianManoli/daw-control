const { ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { initializeGitRepository } = require('./git-handler');

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
}

module.exports = { registerIpcHandlers };
