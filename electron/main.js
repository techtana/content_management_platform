const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

const isDev = !app.isPackaged;

app.whenReady().then(async () => {
  if (!isDev) {
    // Point dotenv at the unpacked config dir (editable without repacking)
    process.env.CMS_CONFIG_PATH = path.join(
      process.resourcesPath,
      'app.asar.unpacked',
      'config',
      'config.env'
    );
  }

  const { startServer } = require('../app.js');
  await startServer();

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'GitHub Pages CMS',
    // icon: path.join(__dirname, '..', 'assets', 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Open external links in the OS browser, not inside the window
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  const port = process.env.CMS_PORT || process.env.PORT || 3000;
  const url = isDev ? 'http://127.0.0.1:5173' : `http://127.0.0.1:${port}`;
  await win.loadURL(url);
});

app.on('window-all-closed', () => app.quit());
