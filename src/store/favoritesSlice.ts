import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { FavoritesState } from '@/types';

const initialState: FavoritesState = {
  fileIds: [],
};

const favoritesSlice = createSlice({
  name: 'favorites',
  initialState,
  reducers: {
    toggleFavorite: (state, action: PayloadAction<string>) => {
      const fileId = action.payload;
      const index = state.fileIds.indexOf(fileId);
      if (index !== -1) {
        state.fileIds.splice(index, 1);
      } else {
        state.fileIds.push(fileId);
      }
    },
    addFavorite: (state, action: PayloadAction<string>) => {
      if (!state.fileIds.includes(action.payload)) {
        state.fileIds.push(action.payload);
      }
    },
    removeFavorite: (state, action: PayloadAction<string>) => {
      state.fileIds = state.fileIds.filter(id => id !== action.payload);
    },
    clearFavorites: (state) => {
      state.fileIds = [];
    },
    setFavorites: (state, action: PayloadAction<string[]>) => {
      state.fileIds = action.payload;
    },
  },
});

export const {
  toggleFavorite,
  addFavorite,
  removeFavorite,
  clearFavorites,
  setFavorites,
} = favoritesSlice.actions;

export default favoritesSlice.reducer;
