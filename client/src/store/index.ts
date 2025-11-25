import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import batchReducer from './batchSlice';
import uiReducer from './uiSlice';
import recipesReducer from './recipesSlice';
import materialsReducer from './materialsSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    batch: batchReducer,
    ui: uiReducer,
    recipes: recipesReducer,
    materials: materialsReducer,
  },
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types
        ignoredActions: ['batch/updateLoadCellData'],
      },
    }),
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
