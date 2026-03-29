import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { UIState, Notification } from '@/types';
import { DEFAULT_HOTKEYS } from '@utils/hotkeys';

const initialState: UIState = {
  isSidebarOpen: true,
  theme: 'dark',
  language: 'ru',
  windowSettings: {
    trayMode: false,
    width: 1400,
    height: 900,
    opacity: 82,
    accentColor: '#4f9dff',
    autoStart: false,
  },
  playerSettings: {
    delayEnabled: false,
    playbackDelaySec: 0,
  },
  hotkeys: DEFAULT_HOTKEYS,
  autoSaveOnAdd: false,
  notifications: [],
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
    setLanguage: (state, action: PayloadAction<'ru' | 'en'>) => {
      state.language = action.payload;
    },
    setWindowSettings: (state, action: PayloadAction<Partial<UIState['windowSettings']>>) => {
      state.windowSettings = { ...state.windowSettings, ...action.payload };
    },
    setPlayerSettings: (state, action: PayloadAction<Partial<UIState['playerSettings']>>) => {
      state.playerSettings = { ...state.playerSettings, ...action.payload };
    },
    setHotkeys: (state, action: PayloadAction<Partial<UIState['hotkeys']>>) => {
      state.hotkeys = { ...state.hotkeys, ...action.payload };
    },
    setAutoSaveOnAdd: (state, action: PayloadAction<boolean>) => {
      state.autoSaveOnAdd = action.payload;
    },
    resetHotkeys: (state) => {
      state.hotkeys = DEFAULT_HOTKEYS;
    },
    addNotification: (state, action: PayloadAction<Omit<Notification, 'id' | 'createdAt'>>) => {
      const now = Date.now();
      const duplicate = state.notifications.find(
        (item) =>
          item.type === action.payload.type &&
          item.title === action.payload.title &&
          item.message === action.payload.message &&
          now - item.createdAt < 1200
      );

      if (duplicate) return;

      const notification: Notification = {
        ...action.payload,
        id: `notif_${now}_${Math.random().toString(36).slice(2, 11)}`,
        createdAt: now,
      };

      state.notifications.push(notification);
      if (state.notifications.length > 8) {
        state.notifications.splice(0, state.notifications.length - 8);
      }
    },
    removeNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter((notification) => notification.id !== action.payload);
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
  setLanguage,
  setWindowSettings,
  setPlayerSettings,
  setHotkeys,
  setAutoSaveOnAdd,
  resetHotkeys,
  addNotification,
  removeNotification,
  clearNotifications,
} = uiSlice.actions;

export default uiSlice.reducer;
