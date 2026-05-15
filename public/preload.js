const { contextBridge, ipcRenderer } = require('electron');

const listenerMap = new Map();

function addListener(channel, callback) {
  const wrapped = (_event, ...args) => callback(...args);
  if (!listenerMap.has(channel)) {
    listenerMap.set(channel, new Map());
  }

  listenerMap.get(channel).set(callback, wrapped);
  ipcRenderer.on(channel, wrapped);
}

function removeListener(channel, callback) {
  const channelListeners = listenerMap.get(channel);
  if (!channelListeners) return;

  const wrapped = channelListeners.get(callback);
  if (!wrapped) return;

  ipcRenderer.removeListener(channel, wrapped);
  channelListeners.delete(callback);

  if (channelListeners.size === 0) {
    listenerMap.delete(channel);
  }
}

contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel, data) => ipcRenderer.send(channel, data),
  on: (channel, callback) => addListener(channel, callback),
  off: (channel, callback) => removeListener(channel, callback),
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
    listenerMap.delete(channel);
  },
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),

  openFileDialog: () => ipcRenderer.send('open-file-dialog'),
  pickMediaFolder: () => ipcRenderer.invoke('pick-media-folder'),
  loadSavedPlaylists: () => ipcRenderer.invoke('load-saved-playlists'),
  deletePlaylistFolder: (name) => ipcRenderer.invoke('delete-playlist-folder', name),
  saveFilesToPlaylist: (name, files) => ipcRenderer.invoke('save-files-to-playlist', name, files),
  openPlaylistsFolder: () => ipcRenderer.invoke('open-playlists-folder'),
  showNotification: (title, message) => ipcRenderer.send('show-notification', title, message),
  getWindowSettings: () => ipcRenderer.invoke('get-window-settings'),
  setWindowSettings: (settings) => ipcRenderer.invoke('set-window-settings', settings),
  setAutoStart: (enabled) => ipcRenderer.invoke('set-auto-start', enabled),
  getAutoStart: () => ipcRenderer.invoke('get-auto-start'),
  setTrayMode: (enabled) => ipcRenderer.invoke('set-tray-mode', enabled),
  getTrayMode: () => ipcRenderer.invoke('get-tray-mode'),
  setGlobalHotkeys: (bindings) => ipcRenderer.invoke('set-global-hotkeys', bindings),
  getGlobalHotkeys: () => ipcRenderer.invoke('get-global-hotkeys'),
  exportPlaylistArchive: (payload) => ipcRenderer.invoke('export-playlist-archive', payload),
  previewPlaylistImport: (payload) => ipcRenderer.invoke('preview-playlist-import', payload),
  applyPlaylistImport: (token) => ipcRenderer.invoke('apply-playlist-import', token),
  discardPlaylistImportPreview: (token) => ipcRenderer.invoke('discard-playlist-import-preview', token),
  openUrl: (url) => ipcRenderer.invoke('open-url', url),
  resolveVkVideoUrl: (url) => ipcRenderer.invoke('resolve-vk-video-url', url),
  enterPictureInPicture: () => ipcRenderer.invoke('enter-picture-in-picture'),
  exitPictureInPicture: () => ipcRenderer.invoke('exit-picture-in-picture'),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
});
