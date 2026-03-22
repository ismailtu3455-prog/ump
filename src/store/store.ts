import { configureStore } from '@reduxjs/toolkit';
import playerReducer from './playerSlice';
import playlistReducer from './playlistSlice';
import uiReducer from './uiSlice';
import historyReducer from './historySlice';
import favoritesReducer from './favoritesSlice';

export const store = configureStore({
  reducer: {
    player: playerReducer,
    playlist: playlistReducer,
    ui: uiReducer,
    history: historyReducer,
    favorites: favoritesReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
