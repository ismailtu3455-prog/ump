import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { UIState, Notification } from '@/types';

const initialState: UIState = {
  isSidebarOpen: true,
  theme: 'dark',
  language: 'ru',
  windowSettings: {
    alwaysOnTop: false,
    width: 1400,
    height: 900,
    opacity: 75,
    hardwareAcceleration: true,
    autoStart: false,
    trayMode: false,
  },
  notifications: [],
  isMusicMode: false,
  playerSettings: {
    autoplay: true,
    autoplayDelay: 3,
    autoplayEnabled: true,
  },
  hotkeys: {
    playPause: 'Space',
    next: 'KeyN',
    previous: 'KeyP',
    fullscreen: 'KeyF',
    volumeUp: 'ArrowUp',
    volumeDown: 'ArrowDown',
    seekForward: 'ArrowRight',
    seekBackward: 'ArrowLeft',
  },
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleSidebar: (state) => {
      state.isSidebarOpen = !state.isSidebarOpen;
    },
    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.isSidebarOpen = action.payload;
    },
    setTheme: (state, action: PayloadAction<'dark' | 'light'>) => {
      state.theme = action.payload;
    },
    toggleTheme: (state) => {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
    },
    setLanguage: (state, action: PayloadAction<'ru' | 'en'>) => {
      state.language = action.payload;
    },
    setWindowSettings: (state, action: PayloadAction<Partial<UIState['windowSettings']>>) => {
      state.windowSettings = { ...state.windowSettings, ...action.payload };
    },
    setAlwaysOnTop: (state, action: PayloadAction<boolean>) => {
      state.windowSettings.alwaysOnTop = action.payload;
    },
    setTrayMode: (state, action: PayloadAction<boolean>) => {
      state.windowSettings.trayMode = action.payload;
    },
    toggleMusicMode: (state) => {
      state.isMusicMode = !state.isMusicMode;
    },
    setMusicMode: (state, action: PayloadAction<boolean>) => {
      state.isMusicMode = action.payload;
    },
    setPlayerSettings: (state, action: PayloadAction<Partial<UIState['playerSettings']>>) => {
      state.playerSettings = { ...state.playerSettings, ...action.payload };
    },
    setHotkey: (state, action: PayloadAction<{ key: keyof UIState['hotkeys']; value: string }>) => {
      const { key, value } = action.payload;
      if (state.hotkeys[key]) {
        state.hotkeys[key] = value;
      }
    },
    resetHotkeys: (state) => {
      state.hotkeys = {
        playPause: 'Space',
        next: 'KeyN',
        previous: 'KeyP',
        fullscreen: 'KeyF',
        volumeUp: 'ArrowUp',
        volumeDown: 'ArrowDown',
        seekForward: 'ArrowRight',
        seekBackward: 'ArrowLeft',
      };
    },
    addNotification: (state, action: PayloadAction<Omit<Notification, 'id' | 'createdAt'>>) => {
      const notification: Notification = {
        ...action.payload,
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: Date.now(),
      };
      state.notifications.push(notification);
    },
    removeNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter(n => n.id !== action.payload);
    },
    clearNotifications: (state) => {
      state.notifications = [];
    },
  },
});

export const {
  toggleSidebar,
  setSidebarOpen,
  setTheme,
  toggleTheme,
  setLanguage,
  setWindowSettings,
  setAlwaysOnTop,
  setTrayMode,
  toggleMusicMode,
  setMusicMode,
  setPlayerSettings,
  setHotkey,
  resetHotkeys,
  addNotification,
  removeNotification,
  clearNotifications,
} = uiSlice.actions;

export default uiSlice.reducer;
