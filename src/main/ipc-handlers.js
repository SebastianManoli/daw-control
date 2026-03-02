const { ipcMain, dialog, BrowserWindow, shell } = require('electron');
const path = require('path');
const fsModule = require('fs');
const fs = fsModule.promises;
const {
  initializeGitRepository,
  createCommit,
  getCommitHistory,
  restoreCommit,
  checkWorkingDirectoryStatus,
  discardChanges,
  findAlsFile,
  getFileAtCommit,
  getHeadCommitHash,
  getChangedFiles
} = require('./git-handler');
const { parseAlsContent } = require('./parser-handler');

// Store the current project path
let currentProjectPath = null;

// File watcher state
let fileWatcher = null;
let debounceTimer = null;

/**
 * Send changed files update to all renderer windows
 */
async function sendChangedFilesUpdate() {
  if (!currentProjectPath) return;

  const result = await getChangedFiles(currentProjectPath);
  console.log('Changed files result:', JSON.stringify(result));
  const win = BrowserWindow.getAllWindows()[0];
  if (win) {
    win.webContents.send('changed-files-updated', result);
  }
}

/**
 * Start watching the project folder for file changes
 * @param {string} folderPath - Path to watch
 */
function startFileWatcher(folderPath) {
  stopFileWatcher();

  try {
    fileWatcher = fsModule.watch(folderPath, { recursive: true }, (eventType, filename) => {
      // Ignore changes inside .git directory (handle both / and \ separators)
      if (!filename || filename.startsWith('.git/') || filename.startsWith('.git\\') || filename === '.git') return;

      console.log(`File watcher detected: ${eventType} ${filename}`);

      // Debounce: wait for save operations to finish before checking status
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        console.log('Debounce finished, checking git status...');
        sendChangedFilesUpdate();
      }, 1000);
    });

    fileWatcher.on('error', (err) => {
      console.error('File watcher error:', err);
    });

    console.log('File watcher started for:', folderPath);
  } catch (error) {
    console.error('Failed to start file watcher:', error);
  }
}

/**
 * Stop the current file watcher
 */
function stopFileWatcher() {
  clearTimeout(debounceTimer);
  if (fileWatcher) {
    fileWatcher.close();
    fileWatcher = null;
    console.log('File watcher stopped');
  }
}

/**
 * Open the project's ALS file in the OS default app (Ableton, if associated)
 * @param {string} folderPath - Path to project folder
 * @returns {Promise<{success: boolean, alsPath?: string, error?: string}>}
 */
async function openCurrentAbletonSet(folderPath) {
  const alsResult = await findAlsFile(folderPath);
  if (!alsResult.success) {
    return { success: false, error: alsResult.error };
  }

  const alsPath = path.join(folderPath, alsResult.alsPath);
  const openError = await shell.openPath(alsPath);

  if (openError) {
    return { success: false, error: openError, alsPath };
  }

  return { success: true, alsPath };
}

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
            startFileWatcher(folderPath);
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

    const result = await getCommitHistory(currentProjectPath);
    const headResult = await getHeadCommitHash(currentProjectPath);
    if (headResult.success) {
      result.headCommit = headResult.hash;
    }
    return result;
  });

  // Handle getting changed files (git status)
  ipcMain.handle('get-changed-files', async () => {
    if (!currentProjectPath) {
      return { success: true, files: [] };
    }

    return await getChangedFiles(currentProjectPath);
  });

  // Handle restoring to a specific commit
  ipcMain.handle('restore-commit', async (event, commitHash) => {
    if (!currentProjectPath) {
      dialog.showErrorBox('No Project Open', 'Please open a project first.');
      return { success: false, error: 'No project opened' };
    }

    // Check for uncommitted changes
    const status = await checkWorkingDirectoryStatus(currentProjectPath);

    if (status.hasChanges) {
      // Show dialog asking what to do with uncommitted changes
      const changeResult = await dialog.showMessageBox({
        type: 'warning',
        buttons: ['Cancel', 'Discard Changes', 'Commit Changes'],
        defaultId: 0,
        cancelId: 0,
        title: 'Uncommitted Changes',
        message: 'You have uncommitted changes in your project.',
        detail: `Files modified: ${status.files.join(', ')}\n\nWhat would you like to do before restoring?`
      });

      if (changeResult.response === 0) {
        // User clicked Cancel
        return { success: false, error: 'Cancelled by user' };
      } else if (changeResult.response === 1) {
        // Discard changes
        const discardResult = await discardChanges(currentProjectPath);
        if (!discardResult.success) {
          dialog.showErrorBox('Discard Failed', `Failed to discard changes: ${discardResult.error}`);
          return { success: false, error: discardResult.error };
        }
      } else if (changeResult.response === 2) {
        // Commit changes - ask for message
        const commitMessage = `Work in progress before restoring to ${commitHash.substring(0, 7)}`;
        const commitResult = await createCommit(currentProjectPath, commitMessage);

        if (!commitResult.success) {
          dialog.showErrorBox('Commit Failed', `Failed to commit changes: ${commitResult.error}`);
          return { success: false, error: commitResult.error };
        }
      }
    }

    // Perform the restore
    const restoreResult = await restoreCommit(currentProjectPath, commitHash);

    if (restoreResult.success) {
      const openSetResult = await openCurrentAbletonSet(currentProjectPath);

      if (openSetResult.success) {
        dialog.showMessageBox({
          type: 'info',
          title: 'Version Restored',
          message: 'Project files restored and reopened successfully!',
          detail: `Your project files have been restored to version ${commitHash.substring(0, 7)} and the Live Set was reopened automatically.\n\nThe restored files are uncommitted. You can:\n- Test the project in Ableton\n- Commit if you want to keep this version\n- Discard to go back to the latest version`
        });
      } else {
        dialog.showMessageBox({
          type: 'warning',
          title: 'Version Restored (Reopen Failed)',
          message: 'Project files were restored, but the Live Set could not be opened automatically.',
          detail: `Restored to version ${commitHash.substring(0, 7)}.\n\nAutomatic reopen error: ${openSetResult.error}\n\nYou can still open the set manually from Ableton via File > Open Recent Set.`
        });
      }

      return {
        ...restoreResult,
        reopenedSet: openSetResult.success,
        reopenError: openSetResult.success ? undefined : openSetResult.error,
      };
    } else {
      dialog.showErrorBox('Restore Failed', `Failed to restore: ${restoreResult.error}`);
    }

    return restoreResult;
  });

  // Handle parsing ALS file from a specific commit
  ipcMain.handle('parse-commit', async (event, commitHash) => {
    if (!currentProjectPath) {
      return { success: false, error: 'No project opened' };
    }

    try {
      // Find the ALS file in the project
      const alsResult = await findAlsFile(currentProjectPath);
      if (!alsResult.success) {
        return { success: false, error: alsResult.error };
      }

      // Get the file content from the specified commit
      const fileResult = await getFileAtCommit(
        currentProjectPath,
        commitHash,
        alsResult.alsPath
      );

      if (!fileResult.success) {
        return { success: false, error: fileResult.error };
      }

      // Parse the ALS content
      const parseResult = await parseAlsContent(
        fileResult.content,
        alsResult.alsName
      );

      if (!parseResult.success) {
        return { success: false, error: parseResult.error };
      }

      return {
        success: true,
        data: parseResult.data,
        commitHash: commitHash
      };
    } catch (error) {
      console.error('Error parsing commit:', error);
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerIpcHandlers };
