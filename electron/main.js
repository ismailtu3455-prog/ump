const { app, BrowserWindow, Menu, ipcMain, dialog, Notification, shell, Tray, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const ytdl = require('@distube/ytdl-core');

let mainWindow;
let tray = null;
const isDev = !app.isPackaged;
const PLAYLISTS_DIR = isDev 
  ? path.join(__dirname, '../playlists') 
  : path.join(app.getPath('userData'), 'playlists');
const DOWNLOADER_DIR = isDev
  ? path.join(__dirname, '../downloader')
  : path.join(app.getPath('userData'), 'downloader');

function createWindow() {
  const basePath = isDev ? __dirname : process.resourcesPath;

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 650,
    frame: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(basePath, isDev ? 'preload.js' : '../build/preload.js'),
    },
    icon: path.join(basePath, isDev ? '../public/Untitled Project (1).jpg' : '../build/Untitled Project (1).jpg'),
    backgroundColor: '#0f172a',
    show: false,
  });

  const startUrl = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(basePath, '../build/index.html')}`;

  mainWindow.loadURL(startUrl);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (isDev) mainWindow.webContents.openDevTools();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Обработка закрытия окна при включенном tray mode
  mainWindow.on('close', (e) => {
    if (tray && !mainWindow.isDestroyed()) {
      e.preventDefault();
      mainWindow.hide();
      if (process.platform === 'win32') {
        mainWindow.setSkipTaskbar(true);
      }
    }
  });

  createMenu();
  setupIpcHandlers();

  // Инициализируем YouTube Music API
  if (isDev) {
    initYTMusic();
  }
}

async function initYTMusic() {
  try {
    const ytmusicClient = require('./ytmusic-client');
    const success = await ytmusicClient.init();
    if (success) {
      console.log('[YTMusic] Готов к работе');
    } else {
      console.log('[YTMusic] Не удалось инициализировать');
    }
  } catch (error) {
    console.error('[YTMusic] Ошибка инициализации:', error.message);
  }
}

function createTray() {
  const iconPath = isDev 
    ? path.join(__dirname, '../public/Untitled Project (1).jpg') 
    : path.join(process.resourcesPath, 'build', 'Untitled Project (1).jpg');
  
  const icon = nativeImage.createFromPath(iconPath);
  const trayIcon = icon.resize({ width: 16, height: 16 });
  
  tray = new Tray(trayIcon);
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Play/Pause',
      click: () => {
        mainWindow?.webContents.send('playback-control', 'toggle');
      },
    },
    {
      label: 'Следующий',
      click: () => {
        mainWindow?.webContents.send('playback-control', 'next');
      },
    },
    {
      label: 'Предыдущий',
      click: () => {
        mainWindow?.webContents.send('playback-control', 'prev');
      },
    },
    { type: 'separator' },
    {
      label: 'Показать',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          if (process.platform === 'win32') {
            mainWindow.setSkipTaskbar(false);
          }
          mainWindow.focus();
        }
      },
    },
    {
      label: 'Выход',
      click: () => {
        tray = null;
        app.quit();
      },
    },
  ]);
  
  tray.setToolTip('Universal Media Player');
  tray.setContextMenu(contextMenu);
  
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      if (process.platform === 'win32') {
        mainWindow.setSkipTaskbar(false);
      }
      mainWindow.focus();
    }
  });
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
      icon: path.join(__dirname, isDev ? '../public/Untitled Project (1).jpg' : '../build/Untitled Project (1).jpg'),
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
      mainWindow.setAlwaysOnTop(settings.alwaysOnTop, 'screen-saver');
    }
    if (settings.isMaximized) {
      mainWindow.maximize();
    }

    return { success: true };
  });

  // PiP режим
  ipcMain.handle('enter-picture-in-picture', async () => {
    if (!mainWindow) return { success: false };
    
    // Устанавливаем небольшой размер для PiP
    mainWindow.setSize(400, 300);
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    mainWindow.setVisibleOnAllWorkspaces(true);
    
    return { success: true };
  });

  // Выйти из PiP
  ipcMain.handle('exit-picture-in-picture', async () => {
    if (!mainWindow) return { success: false };
    
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setVisibleOnAllWorkspaces(false);
    mainWindow.setSize(1400, 900);
    
    return { success: true };
  });

  // Свернуть окно
  ipcMain.on('minimize-window', () => {
    if (mainWindow) {
      mainWindow.minimize();
    }
  });

  // Развернуть окно
  ipcMain.on('maximize-window', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  // Закрыть окно
  ipcMain.on('close-window', () => {
    if (mainWindow) {
      mainWindow.close();
    }
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

  // Тестовый обработчик для проверки связи
  ipcMain.handle('test-connection', async () => {
    console.log('Test connection called');
    return { success: true, message: 'Connection OK' };
  });

  // Получить информацию о видео YouTube
  ipcMain.handle('youtube-get-info', async (event, url) => {
    console.log('YouTube get info called with URL:', url);
    try {
      const info = await ytdl.getInfo(url);
      console.log('YouTube info received:', info.videoDetails.title);
      const formats = ytdl.filterFormats(info.formats, 'audioandvideo');
      
      const qualityOptions = [];
      const seenQualities = new Set();
      
      formats.forEach(format => {
        const quality = format.qualityLabel || `${format.audioBitrate}kbps`;
        if (!seenQualities.has(quality)) {
          seenQualities.add(quality);
          qualityOptions.push({
            id: format.itag.toString(),
            quality: quality,
            format: format.container || 'mp4',
            size: format.contentLength ? `${Math.round(parseInt(format.contentLength) / 1024 / 1024)} MB` : '~',
          });
        }
      });

      // Если нет комбинированных форматов, добавим аудио
      if (qualityOptions.length === 0) {
        const audioFormats = ytdl.filterFormats(info.formats, 'audio');
        audioFormats.forEach(format => {
          const quality = `${format.audioBitrate || 128}kbps Audio`;
          if (!seenQualities.has(quality)) {
            seenQualities.add(quality);
            qualityOptions.push({
              id: format.itag.toString(),
              quality: quality,
              format: 'mp3',
              size: '~',
            });
          }
        });
      }

      return {
        success: true,
        videoInfo: {
          title: info.videoDetails.title,
          duration: info.videoDetails.lengthSeconds,
          thumbnail: info.videoDetails.thumbnails[0]?.url || '',
          formats: qualityOptions.length > 0 ? qualityOptions : [
            { id: '18', quality: '360p', format: 'mp4', size: '~' },
            { id: '22', quality: '720p', format: 'mp4', size: '~' },
          ],
        },
      };
    } catch (error) {
      console.error('YouTube info error:', error);
      return { success: false, error: error.message };
    }
  });

  // Скачать видео YouTube
  ipcMain.handle('youtube-download', async (event, url, formatId, fileName) => {
    try {
      // Создаём папку загрузок
      if (!fs.existsSync(DOWNLOADER_DIR)) {
        fs.mkdirSync(DOWNLOADER_DIR, { recursive: true });
      }

      const safeFileName = fileName.replace(/[<>:"/\\|?*]/g, '_').substring(0, 100);
      const filePath = path.join(DOWNLOADER_DIR, `${safeFileName}.mp4`);

      return new Promise((resolve) => {
        const stream = ytdl(url, {
          quality: formatId ? parseInt(formatId) : 'highest',
          filter: formatId ? 'audioandvideo' : 'audioandvideo',
        });

        const fileStream = fs.createWriteStream(filePath);
        let downloadedBytes = 0;
        let totalBytes = 0;

        stream.on('response', (response) => {
          totalBytes = parseInt(response.headers['content-length'], 10) || 0;
        });

        stream.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          const progress = totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : 0;
          if (mainWindow) {
            mainWindow.webContents.send('download-progress', progress);
          }
        });

        stream.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close();
          if (mainWindow) {
            mainWindow.webContents.send('download-complete', filePath);
          }
          resolve({ success: true, path: filePath });
        });

        stream.on('error', (error) => {
          console.error('Download stream error:', error);
          resolve({ success: false, error: error.message });
        });

        fileStream.on('error', (error) => {
          console.error('File stream error:', error);
          resolve({ success: false, error: error.message });
        });
      });
    } catch (error) {
      console.error('Download error:', error);
      return { success: false, error: error.message };
    }
  });

  // Включить/выключить автозагрузку
  ipcMain.handle('set-auto-start', async (event, enable) => {
    try {
      app.setLoginItemSettings({
        openAtLogin: enable,
        openAsHidden: true,
        args: ['--hidden'],
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Проверить статус автозагрузки
  ipcMain.handle('get-auto-start', async () => {
    try {
      const settings = app.getLoginItemSettings();
      return { success: true, enabled: settings.openAtLogin };
    } catch (error) {
      return { success: false, enabled: false };
    }
  });

  // Включить/выключить режим трея
  ipcMain.handle('set-tray-mode', async (event, enable) => {
    try {
      if (enable) {
        if (!tray) {
          createTray();
        }
      } else {
        if (tray) {
          tray.destroy();
          tray = null;
        }
        if (mainWindow) {
          mainWindow.setSkipTaskbar(false);
        }
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Получить статус трея
  ipcMain.handle('get-tray-mode', async () => {
    return { success: true, enabled: tray !== null };
  });

  // Открыть URL в браузере
  ipcMain.handle('open-url', async (event, url) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // YouTube Music API через ytmusic-client
  const ytmusicClient = isDev ? require('./ytmusic-client') : null;

  // Поиск музыки через YouTube Music API
  ipcMain.handle('yt-music-search', async (event, query, limit = 20, filter = 'songs') => {
    if (!ytmusicClient) {
      return { success: false, tracks: [], error: 'YTMusic not available' };
    }
    return await ytmusicClient.search(query, limit, filter);
  });

  // Получить информацию о треке
  ipcMain.handle('yt-music-track-info', async (event, videoId) => {
    if (!ytmusicClient) {
      return { success: false, error: 'YTMusic not available' };
    }
    return await ytmusicClient.getTrackInfo(videoId);
  });

  // Получить подсказки для поиска
  ipcMain.handle('yt-music-suggestions', async (event, query) => {
    if (!ytmusicClient) {
      return { success: false, suggestions: [], error: 'YTMusic not available' };
    }
    return await ytmusicClient.getSearchSuggestions(query);
  });

  // Получить главную страницу с рекомендациями
  ipcMain.handle('yt-music-home', async (event, limit = 6) => {
    if (!ytmusicClient) {
      return { success: false, error: 'YTMusic not available' };
    }
    return await ytmusicClient.getHome(limit);
  });

  // Получить чарты
  ipcMain.handle('yt-music-charts', async (event, country = 'US') => {
    if (!ytmusicClient) {
      return { success: false, error: 'YTMusic not available' };
    }
    return await ytmusicClient.getCharts(country);
  });

  // Получить информацию об артисте
  ipcMain.handle('yt-music-artist', async (event, artistId) => {
    if (!ytmusicClient) {
      return { success: false, error: 'YTMusic not available' };
    }
    return await ytmusicClient.getArtist(artistId);
  });

  // Получить информацию об альбоме
  ipcMain.handle('yt-music-album', async (event, albumId) => {
    if (!ytmusicClient) {
      return { success: false, error: 'YTMusic not available' };
    }
    return await ytmusicClient.getAlbum(albumId);
  });

  // Получить информацию о плейлисте
  ipcMain.handle('yt-music-playlist', async (event, playlistId) => {
    if (!ytmusicClient) {
      return { success: false, error: 'YTMusic not available' };
    }
    return await ytmusicClient.getPlaylist(playlistId);
  });

  // Получить текст песни
  ipcMain.handle('yt-music-lyrics', async (event, browseId) => {
    if (!ytmusicClient) {
      return { success: false, error: 'YTMusic not available' };
    }
    return await ytmusicClient.getLyrics(browseId);
  });

  // Проверка доступности YouTube Music API
  ipcMain.handle('yt-music-health', async () => {
    return { success: true, status: 'ok' };
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});
