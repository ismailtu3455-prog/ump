const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel, data) => ipcRenderer.send(channel, data),
  on: (channel, callback) => {
    ipcRenderer.on(channel, (event, ...args) => callback(...args));
  },
  off: (channel, callback) => {
    ipcRenderer.removeListener(channel, callback);
  },
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  openFileDialog: () => ipcRenderer.send('open-file-dialog'),
  savePlaylist: (name, files) => ipcRenderer.invoke('save-playlist', name, files),
});
