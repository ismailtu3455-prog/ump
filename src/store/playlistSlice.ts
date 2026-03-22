import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { PlaylistState, Playlist, MediaFile } from '@/types';

const generateId = () => `pl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const initialState: PlaylistState = {
  playlists: [
    {
      id: 'recent',
      name: 'Недавние',
      files: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isSystem: true,
    },
  ],
  activePlaylistId: 'recent',
  currentIndex: -1,
  isShuffled: false,
  repeatMode: 'none',
  searchQuery: '',
  fileOrder: {},
};

const playlistSlice = createSlice({
  name: 'playlist',
  initialState,
  reducers: {
    createPlaylist: (state, action: PayloadAction<string>) => {
      const newPlaylist: Playlist = {
        id: generateId(),
        name: action.payload.trim(),
        files: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isSystem: false,
      };
      state.playlists.push(newPlaylist);
      state.activePlaylistId = newPlaylist.id;
    },
    createPlaylistWithFiles: (state, action: PayloadAction<{ playlist: Playlist }>) => {
      state.playlists.push(action.payload.playlist);
      state.activePlaylistId = action.payload.playlist.id;
    },
    deletePlaylist: (state, action: PayloadAction<string>) => {
      const playlistId = action.payload;
      const playlist = state.playlists.find(p => p.id === playlistId);

      if (!playlist || playlist.isSystem) {
        return;
      }
      state.playlists = state.playlists.filter(p => p.id !== playlistId);
      if (state.activePlaylistId === playlistId) {
        state.activePlaylistId = 'recent';
      }
    },
    renamePlaylist: (state, action: PayloadAction<{ playlistId: string; newName: string }>) => {
      const { playlistId, newName } = action.payload;
      const playlist = state.playlists.find(p => p.id === playlistId);
      if (playlist && !playlist.isSystem) {
        playlist.name = newName.trim();
        playlist.updatedAt = Date.now();
      }
    },
    addFilesToPlaylist: (state, action: PayloadAction<{ playlistId: string; files: MediaFile[] }>) => {
      const { playlistId, files } = action.payload;
      const playlist = state.playlists.find(p => p.id === playlistId);
      if (!playlist) return;

      const existingIds = new Set(playlist.files.map(f => f.id));
      const newFiles = files.filter(f => !existingIds.has(f.id));
      playlist.files.push(...newFiles);
      playlist.updatedAt = Date.now();

      if (state.currentIndex === -1 && newFiles.length > 0) {
        state.currentIndex = 0;
      }
    },
    removeFileFromPlaylist: (state, action: PayloadAction<{ playlistId: string; fileId: string }>) => {
      const { playlistId, fileId } = action.payload;
      const playlist = state.playlists.find(p => p.id === playlistId);
      if (!playlist) return;

      const index = playlist.files.findIndex(f => f.id === fileId);
      playlist.files = playlist.files.filter(f => f.id !== fileId);
      playlist.updatedAt = Date.now();

      if (state.currentIndex === index) {
        state.currentIndex = Math.min(index, playlist.files.length - 1);
      } else if (state.currentIndex > index) {
        state.currentIndex--;
      }
    },
    reorderFiles: (state, action: PayloadAction<{ playlistId: string; fromIndex: number; toIndex: number }>) => {
      const { playlistId, fromIndex, toIndex } = action.payload;
      const playlist = state.playlists.find(p => p.id === playlistId);
      if (!playlist) return;

      const [removed] = playlist.files.splice(fromIndex, 1);
      playlist.files.splice(toIndex, 0, removed);
      playlist.updatedAt = Date.now();
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
    setActivePlaylist: (state, action: PayloadAction<string>) => {
      if (state.playlists.some(p => p.id === action.payload)) {
        state.activePlaylistId = action.payload;
        state.currentIndex = -1;
      }
    },
    setCurrentIndex: (state, action: PayloadAction<number>) => {
      const playlist = state.playlists.find(p => p.id === state.activePlaylistId);
      if (playlist && action.payload >= -1 && action.payload < playlist.files.length) {
        state.currentIndex = action.payload;
      }
    },
    nextTrack: (state) => {
      const playlist = state.playlists.find(p => p.id === state.activePlaylistId);
      if (!playlist || playlist.files.length === 0) return;

      if (state.repeatMode === 'one') return;

      let nextIndex = state.currentIndex + 1;
      
      if (state.repeatMode === 'random') {
        // Случайный трек
        nextIndex = Math.floor(Math.random() * playlist.files.length);
      } else if (nextIndex >= playlist.files.length) {
        // Конец плейлиста
        if (state.repeatMode === 'all') {
          nextIndex = 0; // Начать заново
        } else {
          nextIndex = playlist.files.length - 1; // Остановиться на последнем
        }
      }
      
      state.currentIndex = nextIndex;
    },
    previousTrack: (state) => {
      const playlist = state.playlists.find(p => p.id === state.activePlaylistId);
      if (!playlist || playlist.files.length === 0) return;
      state.currentIndex = Math.max(0, state.currentIndex - 1);
    },
    toggleShuffle: (state) => {
      state.isShuffled = !state.isShuffled;
    },
    toggleRepeatMode: (state) => {
      // Циклическое переключение: none -> all -> one -> random -> none
      const modes: ('none' | 'all' | 'one' | 'random')[] = ['none', 'all', 'one', 'random'];
      const currentIndex = modes.indexOf(state.repeatMode);
      state.repeatMode = modes[(currentIndex + 1) % modes.length];
    },
    setRepeatMode: (state, action: PayloadAction<'none' | 'all' | 'one' | 'random'>) => {
      state.repeatMode = action.payload;
    },
    moveFileBetweenPlaylists: (state, action: PayloadAction<{ fromPlaylistId: string; toPlaylistId: string; fileId: string }>) => {
      const { fromPlaylistId, toPlaylistId, fileId } = action.payload;
      const fromPlaylist = state.playlists.find(p => p.id === fromPlaylistId);
      const toPlaylist = state.playlists.find(p => p.id === toPlaylistId);

      if (!fromPlaylist || !toPlaylist || fromPlaylistId === toPlaylistId) return;

      const fileIndex = fromPlaylist.files.findIndex(f => f.id === fileId);
      if (fileIndex === -1) return;

      const [file] = fromPlaylist.files.splice(fileIndex, 1);
      toPlaylist.files.push({ ...file, playlistId: toPlaylistId });

      fromPlaylist.updatedAt = Date.now();
      toPlaylist.updatedAt = Date.now();

      if (state.currentIndex === fileIndex) {
        state.currentIndex = -1;
      } else if (state.currentIndex > fileIndex) {
        state.currentIndex--;
      }
    },
    updateFileProgress: (state, action: PayloadAction<{ playlistId: string; fileId: string; progress: number }>) => {
      const { playlistId, fileId, progress } = action.payload;
      const playlist = state.playlists.find(p => p.id === playlistId);
      if (!playlist) return;

      const file = playlist.files.find(f => f.id === fileId);
      if (file) {
        file.watchedProgress = progress;
      }
    },
    toggleFavorite: (state, action: PayloadAction<{ playlistId: string; fileId: string }>) => {
      const { playlistId, fileId } = action.payload;
      const playlist = state.playlists.find(p => p.id === playlistId);
      if (!playlist) return;

      const file = playlist.files.find(f => f.id === fileId);
      if (file) {
        file.isFavorite = !file.isFavorite;
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
  reorderFiles,
  setSearchQuery,
  setActivePlaylist,
  setCurrentIndex,
  nextTrack,
  previousTrack,
  toggleShuffle,
  toggleRepeatMode,
  setRepeatMode,
  moveFileBetweenPlaylists,
  updateFileProgress,
  toggleFavorite,
} = playlistSlice.actions;

export default playlistSlice.reducer;
