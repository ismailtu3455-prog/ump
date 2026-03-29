export type MediaType = 'video' | 'audio' | 'image';
export type Language = 'ru' | 'en';
export type ThemeMode = 'dark' | 'light';
export type RepeatMode = 'none' | 'all' | 'one' | 'random';
export type HotkeyAction =
  | 'togglePlayPause'
  | 'previousTrack'
  | 'nextTrack'
  | 'toggleRepeat'
  | 'seekBackward'
  | 'seekForward'
  | 'volumeDown'
  | 'volumeUp'
  | 'speedDown'
  | 'speedUp'
  | 'speedReset'
  | 'toggleMute'
  | 'toggleFullscreen'
  | 'openFiles';
export type Hotkeys = Record<HotkeyAction, string>;

export interface MediaFile {
  id: string;
  name: string;
  path: string;
  type: MediaType;
  format: string;
  size?: number;
  duration?: number;
  thumbnail?: string;
  addedAt: number;
  isBlob?: boolean;
  isSaved?: boolean;
  isFavorite?: boolean;
  watchedProgress?: number;
}

export interface Playlist {
  id: string;
  name: string;
  files: MediaFile[];
  createdAt: number;
  updatedAt: number;
  isSystem?: boolean;
}

export interface PlayerState {
  currentFile: MediaFile | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  isFullscreen: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface PlaylistState {
  playlists: Playlist[];
  activePlaylistId: string;
  currentIndex: number;
  repeatMode: RepeatMode;
  searchQuery: string;
}

export interface WindowSettings {
  trayMode: boolean;
  width: number;
  height: number;
  opacity: number;
  accentColor: string;
  autoStart: boolean;
}

export interface PlayerSettings {
  delayEnabled: boolean;
  playbackDelaySec: number;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  createdAt: number;
}

export interface UIState {
  isSidebarOpen: boolean;
  theme: ThemeMode;
  language: Language;
  windowSettings: WindowSettings;
  playerSettings: PlayerSettings;
  hotkeys: Hotkeys;
  autoSaveOnAdd: boolean;
  notifications: Notification[];
}

declare global {
  interface Window {
    electronAPI?: {
      send: (channel: string, data?: unknown) => void;
      on: (channel: string, callback: (...args: any[]) => void) => void;
      off: (channel: string, callback: (...args: any[]) => void) => void;
      removeAllListeners: (channel: string) => void;
      invoke: (channel: string, ...args: any[]) => Promise<any>;
      openFileDialog: () => void;
      loadSavedPlaylists: () => Promise<any>;
      deletePlaylistFolder: (name: string) => Promise<any>;
      saveFilesToPlaylist: (name: string, files: any[]) => Promise<any>;
      openPlaylistsFolder: () => Promise<any>;
      getWindowSettings: () => Promise<any>;
      setWindowSettings: (settings: Partial<WindowSettings>) => Promise<any>;
      setAutoStart: (enabled: boolean) => Promise<any>;
      getAutoStart: () => Promise<any>;
      setTrayMode: (enabled: boolean) => Promise<any>;
      getTrayMode: () => Promise<any>;
      openUrl: (url: string) => Promise<any>;
      enterPictureInPicture: () => Promise<any>;
      exitPictureInPicture: () => Promise<any>;
      minimizeWindow: () => void;
      maximizeWindow: () => void;
      closeWindow: () => void;
    };
  }
}

