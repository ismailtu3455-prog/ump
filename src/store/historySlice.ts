import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { HistoryItem } from '@/types';

const initialState: HistoryItem[] = [];

const historySlice = createSlice({
  name: 'history',
  initialState,
  reducers: {
    addToHistory: (state, action: PayloadAction<HistoryItem>) => {
      // Удаляем существующую запись если есть
      const existingIndex = state.findIndex(h => h.fileId === action.payload.fileId);
      if (existingIndex !== -1) {
        state.splice(existingIndex, 1);
      }
      // Добавляем в начало
      state.unshift(action.payload);
      // Оставляем только последние 100 записей
      if (state.length > 100) {
        state.splice(100);
      }
    },
    removeFromHistory: (_state, action: PayloadAction<string>) => {
      return _state.filter(h => h.id !== action.payload);
    },
    clearHistory: () => {
      return [];
    },
    updateHistoryProgress: (state, action: PayloadAction<{ fileId: string; progress: number }>) => {
      const { fileId, progress } = action.payload;
      const item = state.find(h => h.fileId === fileId);
      if (item) {
        item.watchedProgress = progress;
      }
    },
  },
});

export const {
  addToHistory,
  removeFromHistory,
  clearHistory,
  updateHistoryProgress,
} = historySlice.actions;

export default historySlice.reducer;
