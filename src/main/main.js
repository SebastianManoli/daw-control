const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const { getMenuTemplate } = require('./menu');
const { registerIpcHandlers } = require('./ipc-handlers');

const isDev = !app.isPackaged;
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 600,
    frame: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: "src/renderer/styles/Asset 8@4x.png"
  });

  // Hide the default menu bar (we render our own in the renderer)
  mainWindow.setMenuBarVisibility(false);

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
  }
}

// Window control IPC handlers
ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.on('window-close', () => mainWindow?.close());

// Menu popup IPC handler
ipcMain.handle('get-menu-labels', () => {
  const template = getMenuTemplate();
  return template.map((item) => item.label);
});

ipcMain.on('popup-menu', (event, menuLabel) => {
  const template = getMenuTemplate();
  const menuItem = template.find((item) => item.label === menuLabel);
  if (menuItem?.submenu) {
    const menu = Menu.buildFromTemplate(menuItem.submenu);
    menu.popup({ window: mainWindow });
  }
});

app.whenReady().then(() => {
  registerIpcHandlers();
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
