const { app, BrowserWindow, Menu, ipcMain, dialog, Notification, shell } = require('electron');
const path = require('path');
const fs = require('fs');
// ytdl закомментирован из-за проблем совместимости с Electron
// const ytdl = require('@distube/ytdl-core');

let mainWindow;
let isReady = false;
let pendingFilePath = null;
const isDev = !app.isPackaged;
const PLAYLISTS_DIR = isDev
  ? path.join(__dirname, '../playlists')
  : path.join(app.getPath('userData'), 'playlists');

function createWindow(filePath = null) {
  const basePath = isDev ? __dirname : path.join(process.resourcesPath, 'build');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 650,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(basePath, 'preload.js'),
    },
    icon: isDev ? path.join(__dirname, 'icon.png') : path.join(basePath, 'icon.png'),
    backgroundColor: '#0f172a',
    show: false,
    frame: true,
  });

  const startUrl = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(basePath, 'index.html')}`;

  mainWindow.loadURL(startUrl);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) mainWindow.webContents.openDevTools();
    
    // Если есть файл для открытия, отправляем его после загрузки
    if (filePath || pendingFilePath) {
      setTimeout(() => {
        const fileToOpen = filePath || pendingFilePath;
        if (fileToOpen && isValidMediaFile(fileToOpen)) {
          console.log('Sending file to app:', fileToOpen);
          mainWindow.webContents.send('file-opened', [fileToOpen]);
        }
      }, 500);
    }
    isReady = true;
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    isReady = false;
  });

  createMenu();
  setupIpcHandlers();
}

function createMenu() {
  const template = [
    {
      label: 'Файл',
      submenu: [
        {
          label: 'Открыть файл',
          accelerator: 'CmdOrCtrl+O',
          click: () => openFileDialog(),
        },
        { type: 'separator' },
        {
          label: 'Выход',
          accelerator: 'CmdOrCtrl+Q',
          click: () => app.quit(),
        },
      ],
    },
    {
      label: 'Вид',
      submenu: [
        {
          label: 'Перезагрузить',
          accelerator: 'CmdOrCtrl+R',
          click: () => mainWindow?.webContents.reload(),
        },
        {
          label: 'Инструменты разработчика',
          accelerator: 'F12',
          click: () => mainWindow?.webContents.toggleDevTools(),
        },
      ],
    },
    {
      label: 'Воспроизведение',
      submenu: [
        {
          label: 'Play/Pause',
          accelerator: 'Space',
          click: () => mainWindow?.webContents.send('playback-control', 'toggle'),
        },
        {
          label: 'Следующий',
          accelerator: 'N',
          click: () => mainWindow?.webContents.send('playback-control', 'next'),
        },
        {
          label: 'Предыдущий',
          accelerator: 'P',
          click: () => mainWindow?.webContents.send('playback-control', 'prev'),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function openFileDialog() {
  dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Все медиа', extensions: ['mp4', 'webm', 'ogg', 'avi', 'mov', 'mkv', 'mp3', 'wav', 'flac', 'jpg', 'png', 'webp'] },
      { name: 'Видео', extensions: ['mp4', 'webm', 'ogg', 'avi', 'mov', 'mkv'] },
      { name: 'Аудио', extensions: ['mp3', 'wav', 'flac', 'aac', 'ogg'] },
      { name: 'Изображения', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'] },
      { name: 'Все файлы', extensions: ['*'] },
    ],
  }).then(result => {
    if (!result.canceled && result.filePaths.length > 0) {
      // Отправляем файлы через files-selected (для Sidebar)
      mainWindow.webContents.send('files-selected', result.filePaths);
    }
  });
}

function setupIpcHandlers() {
  // Открытие диалога файлов
  ipcMain.on('open-file-dialog', () => {
    openFileDialog();
  });

  // Загрузка сохранённых плейлистов
  ipcMain.handle('load-saved-playlists', async () => {
    try {
      if (!fs.existsSync(PLAYLISTS_DIR)) {
        return { success: true, playlists: [] };
      }

      const playlistDirs = fs.readdirSync(PLAYLISTS_DIR).filter(item => {
        const itemPath = path.join(PLAYLISTS_DIR, item);
        return fs.statSync(itemPath).isDirectory();
      });

      const playlists = [];
      for (const dir of playlistDirs) {
        const dirPath = path.join(PLAYLISTS_DIR, dir);
        const filesJsonPath = path.join(dirPath, 'files.json');

        if (fs.existsSync(filesJsonPath)) {
          const filesJson = JSON.parse(fs.readFileSync(filesJsonPath, 'utf-8'));
          playlists.push({
            name: dir,
            savedFiles: filesJson.files || [],
          });
        }
      }

      return { success: true, playlists };
    } catch (error) {
      console.error('Error loading playlists:', error);
      return { success: false, error: error.message, playlists: [] };
    }
  });

  // Создание папки плейлиста
  ipcMain.handle('create-playlist-folder', async (event, playlistName) => {
    try {
      const targetDir = path.join(PLAYLISTS_DIR, playlistName);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      return { success: true, path: targetDir };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Удаление папки плейлиста
  ipcMain.handle('delete-playlist-folder', async (event, playlistName) => {
    try {
      const targetDir = path.join(PLAYLISTS_DIR, playlistName);
      console.log('Deleting playlist folder:', targetDir);
      if (fs.existsSync(targetDir)) {
        fs.rmSync(targetDir, { recursive: true, force: true });
        console.log('Folder deleted successfully');
      } else {
        console.log('Folder does not exist');
      }
      return { success: true };
    } catch (error) {
      console.error('Error deleting folder:', error);
      return { success: false, error: error.message };
    }
  });

  // Открыть папку плейлистов
  ipcMain.handle('open-playlists-folder', async () => {
    try {
      console.log('Playlists directory:', PLAYLISTS_DIR);
      if (!fs.existsSync(PLAYLISTS_DIR)) {
        fs.mkdirSync(PLAYLISTS_DIR, { recursive: true });
      }
      
      // Пробуем открыть через shell.openPath
      const result = shell.openPath(PLAYLISTS_DIR);
      console.log('shell.openPath result:', result);
      console.log('Opened playlists folder:', PLAYLISTS_DIR);
      
      return { success: true, path: PLAYLISTS_DIR };
    } catch (error) {
      console.error('Error opening folder:', error);
      return { success: false, error: error.message };
    }
  });

  // Сохранение файлов плейлиста
  ipcMain.handle('save-files-to-playlist', async (event, playlistName, files) => {
    console.log('=== save-files-to-playlist called ===');
    console.log('Playlist name:', playlistName);
    console.log('Files to save:', files.length);
    console.log('Files:', files);
    
    try {
      const targetDir = path.join(PLAYLISTS_DIR, playlistName);
      console.log('Target directory:', targetDir);
      
      if (!fs.existsSync(targetDir)) {
        console.log('Creating directory:', targetDir);
        fs.mkdirSync(targetDir, { recursive: true });
      }

      let copiedCount = 0;
      let errorCount = 0;
      let skippedCount = 0;
      const savedFiles = [];

      for (const file of files) {
        try {
          // Очищаем путь от file:// и лишних слешей
          let sourcePath = file.path.replace('file:///', '').replace(/^\//, '');
          
          // Для Windows путей
          if (sourcePath.startsWith('/') && sourcePath.length > 1) {
            sourcePath = sourcePath.substring(1);
          }

          const fileName = path.basename(sourcePath);
          const targetPath = path.join(targetDir, fileName);

          // Проверяем существует ли уже файл
          if (fs.existsSync(targetPath)) {
            skippedCount++;
            savedFiles.push({
              name: fileName,
              path: targetPath,
              originalPath: sourcePath,
            });
            continue;
          }

          fs.copyFileSync(sourcePath, targetPath);
          copiedCount++;
          savedFiles.push({
            name: fileName,
            path: targetPath,
            originalPath: sourcePath,
          });
        } catch (err) {
          console.error(`Ошибка копирования ${file.name}:`, err);
          errorCount++;
        }
      }

      // Сохраняем files.json с информацией о файлах
      const filesJsonPath = path.join(targetDir, 'files.json');
      fs.writeFileSync(filesJsonPath, JSON.stringify({ files: savedFiles, createdAt: Date.now() }, null, 2));

      return { 
        success: true, 
        copiedCount, 
        errorCount, 
        skippedCount,
        path: targetDir 
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Сохранение плейлиста (старый обработчик)
  ipcMain.handle('save-playlist', async (event, playlistName, files) => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        defaultPath: app.getPath('videos'),
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: 'Отменено' };
      }

      const targetDir = path.join(result.filePaths[0], playlistName);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      let copiedCount = 0;
      for (const file of files) {
        try {
          let sourcePath = file.path.replace('file:///', '').replace(/^\//, '');
          const fileName = path.basename(sourcePath);
          fs.copyFileSync(sourcePath, path.join(targetDir, fileName));
          copiedCount++;
        } catch (err) {
          console.error(`Ошибка копирования ${file.name}:`, err);
        }
      }

      return { success: true, copiedCount, folderPath: targetDir };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Экспорт плейлистов в JSON
  ipcMain.handle('export-playlists', async (event, playlists) => {
    try {
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Экспорт плейлистов',
        defaultPath: 'playlists-export.json',
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });

      if (result.canceled || !result.filePath) {
        return { success: false, error: 'Отменено' };
      }

      fs.writeFileSync(result.filePath, JSON.stringify(playlists, null, 2));
      return { success: true, path: result.filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Импорт плейлистов из JSON
  ipcMain.handle('import-playlists', async () => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: 'Отменено' };
      }

      const data = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf-8'));
      return { success: true, playlists: data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Показать уведомление
  ipcMain.on('show-notification', (event, title, message) => {
    const notification = new Notification({
      title,
      body: message,
      icon: path.join(__dirname, isDev ? '../public/icon.png' : '../build/icon.png'),
    });
    notification.show();
  });

  // Получить настройки окна
  ipcMain.handle('get-window-settings', async () => {
    if (!mainWindow) return null;
    const bounds = mainWindow.getBounds();
    return {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      isMaximized: mainWindow.isMaximized(),
      alwaysOnTop: mainWindow.isAlwaysOnTop(),
    };
  });

  // Установить настройки окна
  ipcMain.handle('set-window-settings', async (event, settings) => {
    if (!mainWindow) return { success: false };
    
    if (settings.width && settings.height) {
      mainWindow.setSize(settings.width, settings.height);
    }
    if (settings.x !== undefined && settings.y !== undefined) {
      mainWindow.setPosition(settings.x, settings.y);
    }
    if (settings.alwaysOnTop !== undefined) {
      mainWindow.setAlwaysOnTop(settings.alwaysOnTop);
    }
    if (settings.isMaximized) {
      mainWindow.maximize();
    }
    
    return { success: true };
  });

  // Логирование в файл
  ipcMain.handle('log-to-file', async (event, level, message) => {
    const logDir = path.join(app.getPath('userData'), 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    const date = new Date().toISOString().split('T')[0];
    const logFile = path.join(logDir, `${date}.log`);
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
    
    fs.appendFileSync(logFile, logEntry);
    return { success: true };
  });

  // Открыть URL в браузере
  ipcMain.handle('open-url', async (event, url) => {
    const { shell } = require('electron');
    await shell.openExternal(url);
    return { success: true };
  });

  // Тестовый обработчик для проверки связи
  ipcMain.handle('test-connection', async () => {
    console.log('Test connection called');
    return { success: true, message: 'Connection OK' };
  });

  // Получить информацию о видео YouTube (заглушка)
  ipcMain.handle('youtube-get-info', async () => {
    return { 
      success: false, 
      error: 'Скачивание YouTube временно недоступно.' 
    };
  });

  // Скачать видео YouTube (заглушка)
  ipcMain.handle('youtube-download', async () => {
    return { 
      success: false, 
      error: 'Скачивание YouTube временно недоступно.' 
    };
  });
}

app.on('ready', () => {
  // Получаем файл из аргументов командной строки
  const args = process.argv;
  const filePath = args.find(arg => 
    arg !== '.' && 
    !arg.startsWith('--') && 
    !arg.startsWith('-') &&
    isValidMediaFile(arg)
  );
  
  if (filePath) {
    pendingFilePath = filePath;
  }
  
  createWindow(filePath);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

// Обработка открытия файлов через проводник (Windows)
// Предотвращаем открытие второго окна
app.on('second-instance', (event, commandLine) => {
  event.preventDefault();
  
  if (mainWindow) {
    // Фокусируем существующее окно
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    
    // Отправляем путь к файлу в существующее приложение
    const filePath = commandLine.pop();
    if (filePath && isValidMediaFile(filePath)) {
      console.log('Opening file in existing window:', filePath);
      mainWindow.webContents.send('file-opened', [filePath]);
    }
  }
});

// Проверка расширения файла
function isValidMediaFile(filePath) {
  if (!filePath) return false;
  const ext = path.extname(filePath).toLowerCase().slice(1);
  const validExts = ['mp4', 'webm', 'mkv', 'avi', 'mov', 'mp3', 'wav', 'flac', 'jpg', 'png', 'webp'];
  return validExts.includes(ext);
}

// Обработка открытия файла через double-click (macOS и Linux)
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  if (mainWindow && isValidMediaFile(filePath)) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    mainWindow.webContents.send('file-opened', [filePath]);
  }
});
