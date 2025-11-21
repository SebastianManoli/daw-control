const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile(path.join(__dirname, '../renderer/index.html'));
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Project',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            console.log('New Project clicked');
          }
        },
        {
          label: 'Open Project',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            console.log('Open Project clicked');
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { type: 'separator' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'close' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: async () => {
            const { shell } = require('electron');
            await shell.openExternal('https://github.com/SebastianManoli/daw-control');
          }
        },
        { type: 'separator' },
        {
          label: 'About',
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              title: 'About DAW-Control',
              message: 'DAW-Control',
              detail: 'Version 1.0.0\nVersion control system for Ableton Live'
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  createMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle folder selection
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
        try {
          // Call git init <project path> command
          await execPromise('git init', { cwd: folderPath });
          console.log('Git repository initialized');

          // Create .gitignore
          const gitignoreContent = await fs.readFile(path.join(__dirname, 'text/gitignore.txt'));
          const gitignorePath = path.join(folderPath, '.gitignore');
          await fs.writeFile(gitignorePath, gitignoreContent);
          console.log('.gitignore created');

          // Create .gitattributes
          const gitattributesContent = await fs.readFile(path.join(__dirname, 'text/gitattributes.txt'));
          const gitattributesPath = path.join(folderPath, '.gitattributes');
          await fs.writeFile(gitattributesPath, gitattributesContent);
          console.log('.gitattributes created');

          // Append to .git/config
          const gitConfigContent = await fs.readFile(path.join(__dirname, 'text/gitconfig.txt'));
          const gitConfigPath = path.join(folderPath, '.git/config');
          await fs.appendFile(gitConfigPath, gitConfigContent);
          console.log('.git/config updated with zcat filter configuration');

          dialog.showMessageBox({
            type: 'info',
            title: 'Repository Initialized',
            message: 'Git repository successfully initialized!',
            detail: 'Created .gitignore, .gitattributes, and configured git filters.'
          });

          return { success: true, path: folderPath };
        } catch (gitError) {
          console.error('Error initializing git:', gitError);
          dialog.showErrorBox('Git Initialization Error', `Failed to initialize git repository: ${gitError.message}`);
          return { success: false, error: gitError.message };
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
