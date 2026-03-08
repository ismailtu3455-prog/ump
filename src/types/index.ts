export type MediaType = 'video' | 'audio' | 'image';

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
  playlistId?: string;
  isLink?: boolean;
  isBlob?: boolean;
  isSaved?: boolean;
  isFavorite?: boolean;
  quality?: string;
  lastPlayedAt?: number;
  playCount?: number;
  watchedProgress?: number;
  order?: number;
}

export interface Playlist {
  id: string;
  name: string;
  files: MediaFile[];
  createdAt: number;
  updatedAt: number;
  isSystem?: boolean;
  description?: string;
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

export interface HistoryItem {
  id: string;
  fileId: string;
  fileName: string;
  filePath: string;
  type: MediaType;
  playedAt: number;
  watchedProgress: number;
}

export interface FavoritesState {
  fileIds: string[];
}

export interface PlaylistState {
  playlists: Playlist[];
  activePlaylistId: string;
  currentIndex: number;
  isShuffled: boolean;
  repeatMode: 'none' | 'all' | 'one';
  searchQuery: string;
  fileOrder: Record<string, number>;
}

export interface UIState {
  isSidebarOpen: boolean;
  theme: 'dark' | 'light';
  language: 'ru' | 'en';
  windowSettings: {
    alwaysOnTop: boolean;
    width: number;
    height: number;
    x?: number;
    y?: number;
    opacity?: number;
    hardwareAcceleration?: boolean;
    autoStart?: boolean;
    screenshotHotkey?: string;
  };
  notifications: Notification[];
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  createdAt: number;
}

export interface RootState {
  player: PlayerState;
  playlist: PlaylistState;
  ui: UIState;
  favorites: FavoritesState;
  history: HistoryItem[];
}

declare global {
  interface Window {
    electronAPI?: {
      send: (channel: string, data?: any) => void;
      on: (channel: string, callback: (...args: any[]) => void) => void;
      off: (channel: string, callback: (...args: any[]) => void) => void;
      removeAllListeners: (channel: string) => void;
      invoke: (channel: string, ...args: any[]) => Promise<any>;
      openFileDialog: () => void;
      savePlaylist: (name: string, files: any[]) => Promise<any>;
      loadSavedPlaylists: () => Promise<any>;
      createPlaylistFolder: (name: string) => Promise<any>;
      deletePlaylistFolder: (name: string) => Promise<any>;
      saveFilesToPlaylist: (name: string, files: any[]) => Promise<any>;
      exportPlaylists: (playlists: any[]) => Promise<any>;
      importPlaylists: () => Promise<any>;
      showNotification: (title: string, message: string) => void;
      getWindowSettings: () => Promise<any>;
      setWindowSettings: (settings: any) => Promise<any>;
      logToFile: (level: string, message: string) => Promise<any>;
      youtubeGetInfo: (url: string) => Promise<any>;
      youtubeDownload: (url: string, formatId: string, fileName: string) => Promise<any>;
      openPlaylistsFolder: () => Promise<any>;
      openUrl: (url: string) => Promise<any>;
      setAutoStart: (enable: boolean) => Promise<any>;
      getAutoStart: () => Promise<any>;
      saveScreenshot: (playlistId: string, base64Data: string) => Promise<any>;
    };
  }
}
