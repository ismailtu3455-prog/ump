import { configureStore } from '@reduxjs/toolkit';
import playerReducer from './playerSlice';
import playlistReducer from './playlistSlice';
import uiReducer from './uiSlice';

export const store = configureStore({
  reducer: {
    player: playerReducer,
    playlist: playlistReducer,
    ui: uiReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

