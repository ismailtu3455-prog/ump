const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel, data) => ipcRenderer.send(channel, data),
  on: (channel, callback) => {
    ipcRenderer.on(channel, (event, ...args) => callback(...args));
  },
  off: (channel, callback) => {
    ipcRenderer.removeListener(channel, callback);
  },
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  openFileDialog: () => ipcRenderer.send('open-file-dialog'),
  savePlaylist: (name, files) => ipcRenderer.invoke('save-playlist', name, files),
  loadSavedPlaylists: () => ipcRenderer.invoke('load-saved-playlists'),
  createPlaylistFolder: (name) => ipcRenderer.invoke('create-playlist-folder', name),
  deletePlaylistFolder: (name) => ipcRenderer.invoke('delete-playlist-folder', name),
  saveFilesToPlaylist: (name, files) => ipcRenderer.invoke('save-files-to-playlist', name, files),
  exportPlaylists: (playlists) => ipcRenderer.invoke('export-playlists', playlists),
  importPlaylists: () => ipcRenderer.invoke('import-playlists'),
  showNotification: (title, message) => ipcRenderer.send('show-notification', title, message),
  getWindowSettings: () => ipcRenderer.invoke('get-window-settings'),
  setWindowSettings: (settings) => ipcRenderer.invoke('set-window-settings', settings),
  logToFile: (level, message) => ipcRenderer.invoke('log-to-file', level, message),
  youtubeGetInfo: (url) => ipcRenderer.invoke('youtube-get-info', url),
  youtubeDownload: (url, formatId, fileName) => ipcRenderer.invoke('youtube-download', url, formatId, fileName),
  deletePlaylistFolder: (name) => ipcRenderer.invoke('delete-playlist-folder', name),
  openPlaylistsFolder: () => ipcRenderer.invoke('open-playlists-folder'),
  openUrl: (url) => ipcRenderer.invoke('open-url', url),
  setAutoStart: (enable) => ipcRenderer.invoke('set-auto-start', enable),
  getAutoStart: () => ipcRenderer.invoke('get-auto-start'),
  setTrayMode: (enable) => ipcRenderer.invoke('set-tray-mode', enable),
  getTrayMode: () => ipcRenderer.invoke('get-tray-mode'),
  // YouTube Music API
  ytMusicSearch: (query, limit, filter) => ipcRenderer.invoke('yt-music-search', query, limit, filter),
  ytMusicTrackInfo: (videoId) => ipcRenderer.invoke('yt-music-track-info', videoId),
  ytMusicSuggestions: (query) => ipcRenderer.invoke('yt-music-suggestions', query),
  ytMusicHome: (limit) => ipcRenderer.invoke('yt-music-home', limit),
  ytMusicCharts: (country) => ipcRenderer.invoke('yt-music-charts', country),
  ytMusicArtist: (artistId) => ipcRenderer.invoke('yt-music-artist', artistId),
  ytMusicAlbum: (albumId) => ipcRenderer.invoke('yt-music-album', albumId),
  ytMusicPlaylist: (playlistId) => ipcRenderer.invoke('yt-music-playlist', playlistId),
  ytMusicLyrics: (browseId) => ipcRenderer.invoke('yt-music-lyrics', browseId),
  ytMusicHealth: () => ipcRenderer.invoke('yt-music-health'),
  // PiP режим
  enterPictureInPicture: () => ipcRenderer.invoke('enter-picture-in-picture'),
  exitPictureInPicture: () => ipcRenderer.invoke('exit-picture-in-picture'),
  // Управление окном
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
});
