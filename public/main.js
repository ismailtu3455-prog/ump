const { app, BrowserWindow, Menu, Tray, ipcMain, dialog, Notification, nativeImage, shell } = require('electron');
const fs = require('fs');
const path = require('path');

const isDev = !app.isPackaged;
const PRELOAD_PATH = path.join(__dirname, 'preload.js');
const PLAYLISTS_DIR = isDev
  ? path.join(__dirname, '../playlists')
  : path.join(app.getPath('userData'), 'playlists');

const MEDIA_EXTENSIONS = new Set([
  'mp4',
  'webm',
  'mkv',
  'avi',
  'mov',
  'mp3',
  'wav',
  'flac',
  'm4a',
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'bmp',
]);

function resolveIconPath() {
  const candidates = [
    path.join(__dirname, 'icon.png'),
    path.join(__dirname, '../build/icon.png'),
    path.join(process.resourcesPath || '', 'build', 'icon.png'),
    path.join(__dirname, 'Untitled Project (1).jpg'),
  ];

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

const APP_ICON = resolveIconPath();

let mainWindow = null;
let splashWindow = null;
let tray = null;
let handlersRegistered = false;
let pendingFiles = [];
let trayModeEnabled = false;
let isQuitting = false;

const singleInstanceLock = app.requestSingleInstanceLock();
if (!singleInstanceLock) {
  app.quit();
}

function ensurePlaylistsDirectory() {
  if (!fs.existsSync(PLAYLISTS_DIR)) {
    fs.mkdirSync(PLAYLISTS_DIR, { recursive: true });
  }
}

function normalizeFilePath(filePath) {
  if (!filePath || typeof filePath !== 'string') return '';

  if (filePath.startsWith('file:///')) {
    const decoded = decodeURIComponent(filePath.replace('file:///', ''));
    return process.platform === 'win32' ? decoded.replace(/^\//, '') : `/${decoded}`;
  }

  return filePath;
}

function isValidMediaFile(filePath) {
  const normalized = normalizeFilePath(filePath);
  if (!normalized || normalized.startsWith('-')) return false;

  const ext = path.extname(normalized).toLowerCase().replace('.', '');
  return MEDIA_EXTENSIONS.has(ext);
}

function extractMediaFiles(argv) {
  return argv
    .map((entry) => normalizeFilePath(entry))
    .filter((entry) => entry && isValidMediaFile(entry));
}

function showMainWindow() {
  if (!mainWindow) return;

  mainWindow.setSkipTaskbar(false);

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
}

function hideMainWindowToTray() {
  if (!mainWindow) return;

  mainWindow.hide();
  mainWindow.setSkipTaskbar(true);
}

function updateTrayMenu() {
  if (!tray) return;

  const menu = Menu.buildFromTemplate([
    {
      label: 'Open Player',
      click: () => showMainWindow(),
    },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(menu);
}

function createTray() {
  if (tray) {
    updateTrayMenu();
    return;
  }

  const iconImage = nativeImage.createFromPath(APP_ICON);
  tray = new Tray(iconImage.isEmpty() ? nativeImage.createEmpty() : iconImage);
  tray.setToolTip('Universal Media Player');
  tray.on('click', () => {
    if (!mainWindow) return;

    if (mainWindow.isVisible()) {
      hideMainWindowToTray();
      return;
    }

    showMainWindow();
  });
  tray.on('double-click', () => showMainWindow());

  updateTrayMenu();
}

function destroyTray() {
  if (!tray) return;

  tray.destroy();
  tray = null;
}

function setTrayModeEnabled(enabled) {
  trayModeEnabled = Boolean(enabled);

  if (trayModeEnabled) {
    createTray();
  } else {
    destroyTray();
    if (mainWindow) {
      mainWindow.setSkipTaskbar(false);
    }
  }

  return trayModeEnabled;
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 460,
    height: 300,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: true,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const splashHtml = `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body {
          margin: 0;
          width: 100vw;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: Manrope, Segoe UI, sans-serif;
          background: radial-gradient(circle at 20% 0, rgba(79,157,255,0.34), transparent 45%), linear-gradient(150deg, rgba(12,18,32,0.98), rgba(18,30,54,0.98));
          color: #eef4ff;
          overflow: hidden;
        }

        .card {
          width: 360px;
          border-radius: 24px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          padding: 28px;
          text-align: center;
          background: rgba(255,255,255,0.08);
          backdrop-filter: blur(16px);
        }

        .logo-wrap {
          position: relative;
          width: 76px;
          height: 76px;
          margin: 0 auto 16px;
        }

        .ring,
        .ring2 {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 2px solid rgba(79,157,255,0.45);
          animation: spin 1.6s linear infinite;
        }

        .ring2 {
          inset: 8px;
          border-color: rgba(255,255,255,0.6);
          animation-direction: reverse;
          animation-duration: 1.2s;
        }

        .logo {
          position: absolute;
          inset: 18px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          background: linear-gradient(160deg, #5ba5ff, #2b69ff);
          font-weight: 700;
          letter-spacing: 0.05em;
          box-shadow: 0 0 26px rgba(79,157,255,0.55);
          animation: pulse 1.3s ease-in-out infinite;
        }

        .progress {
          margin-top: 14px;
          height: 4px;
          border-radius: 999px;
          background: rgba(255,255,255,0.18);
          overflow: hidden;
        }

        .progress span {
          display: block;
          height: 100%;
          width: 32%;
          background: linear-gradient(90deg, #4f9dff, #9bc2ff);
          animation: loader 1.1s ease-in-out infinite;
        }

        h1 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          letter-spacing: 0.02em;
        }

        p {
          margin: 8px 0 0;
          font-size: 12px;
          color: rgba(238, 244, 255, 0.72);
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @keyframes pulse {
          0%, 100% { transform: scale(0.92); }
          50% { transform: scale(1); }
        }

        @keyframes loader {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(420%); }
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="logo-wrap">
          <div class="ring"></div>
          <div class="ring2"></div>
          <div class="logo">UM</div>
        </div>
        <h1>Universal Media Player</h1>
        <p>Preparing workspace...</p>
        <div class="progress"><span></span></div>
      </div>
    </body>
  </html>`;

  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`);
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 650,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0b1220',
    icon: APP_ICON,
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: true,
    },
  });

  const startUrl = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, '../build/index.html')}`;

  mainWindow.loadURL(startUrl);

  mainWindow.once('ready-to-show', () => {
    showMainWindow();

    if (splashWindow) {
      setTimeout(() => {
        if (splashWindow && !splashWindow.isDestroyed()) {
          splashWindow.close();
          splashWindow = null;
        }
      }, 320);
    }

    if (isDev) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  });

  mainWindow.webContents.on('did-finish-load', () => {
    flushPendingFiles();
  });

  mainWindow.on('close', (event) => {
    if (trayModeEnabled && !isQuitting) {
      event.preventDefault();
      hideMainWindowToTray();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  createAppMenu();
}

function createAppMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open files',
          accelerator: 'CmdOrCtrl+O',
          click: () => openFileDialog(),
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            isQuitting = true;
            app.quit();
          },
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => mainWindow?.webContents.reload(),
        },
        {
          label: 'Developer Tools',
          accelerator: 'F12',
          click: () => mainWindow?.webContents.toggleDevTools(),
        },
      ],
    },
    {
      label: 'Playback',
      submenu: [
        {
          label: 'Play/Pause',
          accelerator: 'Space',
          click: () => mainWindow?.webContents.send('playback-control', 'toggle'),
        },
        {
          label: 'Next',
          accelerator: 'N',
          click: () => mainWindow?.webContents.send('playback-control', 'next'),
        },
        {
          label: 'Previous',
          accelerator: 'P',
          click: () => mainWindow?.webContents.send('playback-control', 'previous'),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function openFileDialog() {
  if (!mainWindow) return;

  dialog
    .showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        {
          name: 'Media files',
          extensions: Array.from(MEDIA_EXTENSIONS),
        },
        {
          name: 'All files',
          extensions: ['*'],
        },
      ],
    })
    .then((result) => {
      if (result.canceled || result.filePaths.length === 0) return;

      const files = result.filePaths
        .map((filePath) => normalizeFilePath(filePath))
        .filter((filePath) => isValidMediaFile(filePath));

      if (files.length > 0) {
        mainWindow.webContents.send('files-selected', files);
      }
    })
    .catch(() => undefined);
}

function flushPendingFiles() {
  if (!mainWindow || pendingFiles.length === 0) return;

  const unique = Array.from(new Set(pendingFiles.filter((filePath) => isValidMediaFile(filePath))));
  pendingFiles = [];

  if (unique.length > 0) {
    mainWindow.webContents.send('files-opened', unique);
  }
}

function queueFilesForOpen(filePaths) {
  const validFiles = filePaths.filter((filePath) => isValidMediaFile(filePath));
  if (validFiles.length === 0) return;

  if (!mainWindow || mainWindow.webContents.isLoading()) {
    pendingFiles.push(...validFiles);
    return;
  }

  mainWindow.webContents.send('files-opened', validFiles);
}

function setupIpcHandlers() {
  if (handlersRegistered) return;
  handlersRegistered = true;

  ipcMain.on('open-file-dialog', () => {
    openFileDialog();
  });

  ipcMain.handle('load-saved-playlists', async () => {
    try {
      ensurePlaylistsDirectory();

      const folders = fs.readdirSync(PLAYLISTS_DIR).filter((entry) => {
        return fs.statSync(path.join(PLAYLISTS_DIR, entry)).isDirectory();
      });

      const playlists = folders.map((folderName) => {
        const filesPath = path.join(PLAYLISTS_DIR, folderName, 'files.json');
        if (!fs.existsSync(filesPath)) {
          return { name: folderName, savedFiles: [] };
        }

        const content = JSON.parse(fs.readFileSync(filesPath, 'utf-8'));
        return {
          name: folderName,
          savedFiles: Array.isArray(content.files) ? content.files : [],
        };
      });

      return { success: true, playlists };
    } catch (error) {
      return { success: false, playlists: [], error: String(error?.message || error) };
    }
  });

  ipcMain.handle('delete-playlist-folder', async (_event, playlistName) => {
    try {
      ensurePlaylistsDirectory();
      const target = path.join(PLAYLISTS_DIR, playlistName);
      if (fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true });
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error?.message || error) };
    }
  });

  ipcMain.handle('open-playlists-folder', async () => {
    try {
      ensurePlaylistsDirectory();
      const openResult = await shell.openPath(PLAYLISTS_DIR);
      if (openResult) {
        return { success: false, error: openResult };
      }

      return { success: true, path: PLAYLISTS_DIR };
    } catch (error) {
      return { success: false, error: String(error?.message || error) };
    }
  });

  ipcMain.handle('save-files-to-playlist', async (_event, playlistName, files) => {
    try {
      ensurePlaylistsDirectory();
      const playlistPath = path.join(PLAYLISTS_DIR, playlistName);

      await fs.promises.mkdir(playlistPath, { recursive: true });

      const inputFiles = Array.isArray(files) ? files : [];
      const total = inputFiles.length;
      let copiedCount = 0;
      let processed = 0;
      const savedFiles = [];

      const sendProgress = (done = false) => {
        mainWindow?.webContents.send('playlist-save-progress', {
          playlistName,
          processed,
          total,
          copiedCount,
          done,
        });
      };

      if (total === 0) {
        sendProgress(true);
        return { success: true, copiedCount, total };
      }

      for (const file of inputFiles) {
        if (!file?.path) {
          processed += 1;
          sendProgress(false);
          continue;
        }

        const sourcePath = normalizeFilePath(file.path);
        if (!sourcePath || !fs.existsSync(sourcePath)) {
          processed += 1;
          sendProgress(false);
          continue;
        }

        const targetPath = path.join(playlistPath, path.basename(sourcePath));

        if (!fs.existsSync(targetPath)) {
          await fs.promises.copyFile(sourcePath, targetPath);
          copiedCount += 1;
        }

        savedFiles.push({
          name: path.basename(targetPath),
          path: targetPath,
        });

        processed += 1;
        sendProgress(false);
      }

      await fs.promises.writeFile(
        path.join(playlistPath, 'files.json'),
        JSON.stringify({ files: savedFiles, updatedAt: Date.now() }, null, 2)
      );

      sendProgress(true);
      return { success: true, copiedCount, total };
    } catch (error) {
      return { success: false, error: String(error?.message || error) };
    }
  });

  ipcMain.on('show-notification', (_event, title, message) => {
    const notification = new Notification({
      title,
      body: message,
      icon: APP_ICON,
    });

    notification.show();
  });

  ipcMain.handle('get-window-settings', async () => {
    if (!mainWindow) return null;

    const bounds = mainWindow.getBounds();
    return {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      trayMode: trayModeEnabled,
    };
  });

  ipcMain.handle('set-window-settings', async (_event, settings) => {
    if (!mainWindow) return { success: false, error: 'Window is not ready' };

    try {
      if (settings.width && settings.height) {
        mainWindow.setSize(Math.max(900, settings.width), Math.max(600, settings.height));
      }

      if (typeof settings.x === 'number' && typeof settings.y === 'number') {
        mainWindow.setPosition(settings.x, settings.y);
      }

      if (typeof settings.trayMode === 'boolean') {
        setTrayModeEnabled(settings.trayMode);
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: String(error?.message || error) };
    }
  });

  ipcMain.handle('set-auto-start', async (_event, enabled) => {
    try {
      app.setLoginItemSettings({
        openAtLogin: Boolean(enabled),
        openAsHidden: true,
      });

      return { success: true };
    } catch (error) {
      return { success: false, error: String(error?.message || error) };
    }
  });

  ipcMain.handle('get-auto-start', async () => {
    try {
      const settings = app.getLoginItemSettings();
      return { success: true, enabled: Boolean(settings.openAtLogin) };
    } catch (error) {
      return { success: false, enabled: false, error: String(error?.message || error) };
    }
  });

  ipcMain.handle('set-tray-mode', async (_event, enabled) => {
    try {
      setTrayModeEnabled(enabled);
      return { success: true, enabled: trayModeEnabled };
    } catch (error) {
      return { success: false, enabled: trayModeEnabled, error: String(error?.message || error) };
    }
  });

  ipcMain.handle('get-tray-mode', async () => {
    return { success: true, enabled: trayModeEnabled };
  });

  ipcMain.handle('open-url', async (_event, url) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error?.message || error) };
    }
  });

  ipcMain.handle('enter-picture-in-picture', async () => {
    if (!mainWindow) return { success: false, error: 'Window is not ready' };

    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    return { success: true };
  });

  ipcMain.handle('exit-picture-in-picture', async () => {
    if (!mainWindow) return { success: false, error: 'Window is not ready' };

    mainWindow.setAlwaysOnTop(false);
    mainWindow.setVisibleOnAllWorkspaces(false);
    return { success: true };
  });

  ipcMain.on('minimize-window', () => {
    mainWindow?.minimize();
  });

  ipcMain.on('maximize-window', () => {
    if (!mainWindow) return;

    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });

  ipcMain.on('close-window', () => {
    if (trayModeEnabled) {
      hideMainWindowToTray();
      return;
    }

    mainWindow?.close();
  });
}

app.on('second-instance', (_event, commandLine) => {
  if (mainWindow) {
    showMainWindow();
  }

  const files = extractMediaFiles(commandLine);
  if (files.length > 0) {
    queueFilesForOpen(files);
  }
});

app.on('open-file', (event, filePath) => {
  event.preventDefault();
  if (!filePath || !isValidMediaFile(filePath)) return;

  queueFilesForOpen([filePath]);
});

app.on('before-quit', () => {
  isQuitting = true;
  destroyTray();
});

app.whenReady().then(() => {
  app.setAppUserModelId('com.mediaplayer.app');

  ensurePlaylistsDirectory();
  setupIpcHandlers();
  createSplashWindow();
  createMainWindow();

  if (trayModeEnabled) {
    createTray();
  }

  const startupFiles = extractMediaFiles(process.argv);
  if (startupFiles.length > 0) {
    queueFilesForOpen(startupFiles);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !trayModeEnabled) {
    app.quit();
  }
});

app.on('activate', () => {
  if (!mainWindow) {
    createSplashWindow();
    createMainWindow();
    return;
  }

  showMainWindow();
});
