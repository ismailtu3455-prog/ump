import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { PlaylistState, Playlist, MediaFile, RepeatMode } from '@/types';

const createPlaylistId = () => `pl_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

const initialState: PlaylistState = {
  playlists: [
    {
      id: 'recent',
      name: 'Recent',
      files: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isSystem: true,
    },
  ],
  activePlaylistId: 'recent',
  currentIndex: -1,
  repeatMode: 'none',
  searchQuery: '',
};

const playlistSlice = createSlice({
  name: 'playlist',
  initialState,
  reducers: {
    createPlaylist: (state, action: PayloadAction<string>) => {
      const name = action.payload.trim();
      if (!name) return;

      const newPlaylist: Playlist = {
        id: createPlaylistId(),
        name,
        files: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isSystem: false,
      };

      state.playlists.push(newPlaylist);
      state.activePlaylistId = newPlaylist.id;
      state.currentIndex = -1;
    },
    createPlaylistWithFiles: (state, action: PayloadAction<{ playlist: Playlist }>) => {
      const existing = state.playlists.find((item) => item.id === action.payload.playlist.id);
      if (existing) return;

      state.playlists.push(action.payload.playlist);
      state.activePlaylistId = action.payload.playlist.id;
      state.currentIndex = action.payload.playlist.files.length > 0 ? 0 : -1;
    },
    deletePlaylist: (state, action: PayloadAction<string>) => {
      const target = state.playlists.find((playlist) => playlist.id === action.payload);
      if (!target || target.isSystem) return;

      state.playlists = state.playlists.filter((playlist) => playlist.id !== action.payload);

      if (state.activePlaylistId === action.payload) {
        state.activePlaylistId = 'recent';
        state.currentIndex = -1;
      }
    },
    renamePlaylist: (state, action: PayloadAction<{ playlistId: string; newName: string }>) => {
      const { playlistId, newName } = action.payload;
      const playlist = state.playlists.find((item) => item.id === playlistId);
      if (!playlist || playlist.isSystem) return;

      const name = newName.trim();
      if (!name) return;

      playlist.name = name;
      playlist.updatedAt = Date.now();
    },
    addFilesToPlaylist: (state, action: PayloadAction<{ playlistId: string; files: MediaFile[] }>) => {
      const { playlistId, files } = action.payload;
      const playlist = state.playlists.find((item) => item.id === playlistId);
      if (!playlist || files.length === 0) return;

      const knownKeys = new Set(
        playlist.files.map((file) => `${file.path}|${file.name}|${file.type}`)
      );
      const uniqueFiles = files.filter((file) => {
        const fileKey = `${file.path}|${file.name}|${file.type}`;
        if (knownKeys.has(fileKey)) return false;
        knownKeys.add(fileKey);
        return true;
      });

      if (uniqueFiles.length === 0) return;

      playlist.files.push(...uniqueFiles);
      playlist.updatedAt = Date.now();

      if (state.currentIndex === -1 && playlist.id === state.activePlaylistId) {
        state.currentIndex = 0;
      }
    },
    removeFileFromPlaylist: (state, action: PayloadAction<{ playlistId: string; fileId: string }>) => {
      const { playlistId, fileId } = action.payload;
      const playlist = state.playlists.find((item) => item.id === playlistId);
      if (!playlist) return;

      const removedIndex = playlist.files.findIndex((file) => file.id === fileId);
      if (removedIndex === -1) return;

      playlist.files.splice(removedIndex, 1);
      playlist.updatedAt = Date.now();

      if (playlistId === state.activePlaylistId) {
        if (playlist.files.length === 0) {
          state.currentIndex = -1;
        } else if (state.currentIndex > removedIndex) {
          state.currentIndex -= 1;
        } else if (state.currentIndex === removedIndex) {
          state.currentIndex = Math.min(removedIndex, playlist.files.length - 1);
        }
      }
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
    setActivePlaylist: (state, action: PayloadAction<string>) => {
      if (!state.playlists.some((playlist) => playlist.id === action.payload)) return;

      state.activePlaylistId = action.payload;
      const activePlaylist = state.playlists.find((playlist) => playlist.id === action.payload);
      state.currentIndex = activePlaylist && activePlaylist.files.length > 0 ? 0 : -1;
    },
    setCurrentIndex: (state, action: PayloadAction<number>) => {
      const activePlaylist = state.playlists.find((playlist) => playlist.id === state.activePlaylistId);
      if (!activePlaylist) return;

      const index = action.payload;
      if (index < -1 || index >= activePlaylist.files.length) return;

      state.currentIndex = index;
    },
    nextTrack: (state) => {
      const playlist = state.playlists.find((item) => item.id === state.activePlaylistId);
      if (!playlist || playlist.files.length === 0) return;

      if (state.repeatMode === 'one') return;

      if (state.repeatMode === 'random') {
        state.currentIndex = Math.floor(Math.random() * playlist.files.length);
        return;
      }

      const nextIndex = state.currentIndex + 1;
      if (nextIndex < playlist.files.length) {
        state.currentIndex = nextIndex;
        return;
      }

      if (state.repeatMode === 'all') {
        state.currentIndex = 0;
      }
    },
    previousTrack: (state) => {
      const playlist = state.playlists.find((item) => item.id === state.activePlaylistId);
      if (!playlist || playlist.files.length === 0) return;

      if (state.currentIndex <= 0) {
        state.currentIndex = 0;
        return;
      }

      state.currentIndex -= 1;
    },
    setRepeatMode: (state, action: PayloadAction<RepeatMode>) => {
      state.repeatMode = action.payload;
    },
    toggleRepeatMode: (state) => {
      const order: RepeatMode[] = ['none', 'all', 'one', 'random'];
      const current = order.indexOf(state.repeatMode);
      state.repeatMode = order[(current + 1) % order.length];
    },
    updateFileProgress: (state, action: PayloadAction<{ playlistId: string; fileId: string; progress: number }>) => {
      const { playlistId, fileId, progress } = action.payload;
      const playlist = state.playlists.find((item) => item.id === playlistId);
      if (!playlist) return;

      const file = playlist.files.find((item) => item.id === fileId);
      if (!file) return;

      file.watchedProgress = Math.max(0, Math.min(100, progress));
    },
    toggleFavorite: (state, action: PayloadAction<{ playlistId: string; fileId: string }>) => {
      const { playlistId, fileId } = action.payload;
      const playlist = state.playlists.find((item) => item.id === playlistId);
      if (!playlist) return;

      const sourceIndex = playlist.files.findIndex((item) => item.id === fileId);
      if (sourceIndex === -1) return;

      const file = playlist.files[sourceIndex];
      const nextFavorite = !file.isFavorite;
      file.isFavorite = nextFavorite;
      playlist.updatedAt = Date.now();

      if (!nextFavorite || sourceIndex === 0) return;

      const [moved] = playlist.files.splice(sourceIndex, 1);
      playlist.files.unshift(moved);

      if (playlistId !== state.activePlaylistId) return;

      if (state.currentIndex === sourceIndex) {
        state.currentIndex = 0;
      } else if (state.currentIndex >= 0 && state.currentIndex < sourceIndex) {
        state.currentIndex += 1;
      }
    },
  },
});

export const {
  createPlaylist,
  createPlaylistWithFiles,
  deletePlaylist,
  renamePlaylist,
  addFilesToPlaylist,
  removeFileFromPlaylist,
  setSearchQuery,
  setActivePlaylist,
  setCurrentIndex,
  nextTrack,
  previousTrack,
  setRepeatMode,
  toggleRepeatMode,
  updateFileProgress,
  toggleFavorite,
} = playlistSlice.actions;

export default playlistSlice.reducer;

