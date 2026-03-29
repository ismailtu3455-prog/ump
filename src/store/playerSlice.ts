import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { PlayerState, MediaFile } from '@/types';

const initialState: PlayerState = {
  currentFile: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 70,
  isMuted: false,
  playbackRate: 1,
  isFullscreen: false,
  isLoading: false,
  error: null,
};

const playerSlice = createSlice({
  name: 'player',
  initialState,
  reducers: {
    setCurrentFile: (state, action: PayloadAction<MediaFile | null>) => {
      state.currentFile = action.payload;
      state.currentTime = 0;
      state.duration = 0;
      state.error = null;
    },
    setIsPlaying: (state, action: PayloadAction<boolean>) => {
      state.isPlaying = action.payload;
    },
    togglePlay: (state) => {
      state.isPlaying = !state.isPlaying;
    },
    setCurrentTime: (state, action: PayloadAction<number>) => {
      state.currentTime = action.payload;
    },
    setDuration: (state, action: PayloadAction<number>) => {
      state.duration = action.payload;
    },
    setVolume: (state, action: PayloadAction<number>) => {
      state.volume = Math.max(0, Math.min(100, action.payload));
      if (state.volume > 0) state.isMuted = false;
    },
    toggleMute: (state) => {
      state.isMuted = !state.isMuted;
    },
    setPlaybackRate: (state, action: PayloadAction<number>) => {
      state.playbackRate = action.payload;
    },
    setIsFullscreen: (state, action: PayloadAction<boolean>) => {
      state.isFullscreen = action.payload;
    },
    toggleFullscreen: (state) => {
      state.isFullscreen = !state.isFullscreen;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});

export const {
  setCurrentFile,
  setIsPlaying,
  togglePlay,
  setCurrentTime,
  setDuration,
  setVolume,
  toggleMute,
  setPlaybackRate,
  setIsFullscreen,
  toggleFullscreen,
  setLoading,
  setError,
} = playerSlice.actions;

export default playerSlice.reducer;
