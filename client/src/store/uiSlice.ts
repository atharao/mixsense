import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

interface Modal {
  id: string;
  isOpen: boolean;
  data?: any;
}

interface UIState {
  toasts: Toast[];
  modals: Record<string, Modal>;
  loading: Record<string, boolean>;
  sidebarOpen: boolean;
}

const initialState: UIState = {
  toasts: [],
  modals: {},
  loading: {},
  sidebarOpen: true,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    showToast: (state, action: PayloadAction<Omit<Toast, 'id'>>) => {
      const toast: Toast = {
        id: Date.now().toString(),
        ...action.payload,
        duration: action.payload.duration || 5000,
      };
      state.toasts.push(toast);
    },
    hideToast: (state, action: PayloadAction<string>) => {
      state.toasts = state.toasts.filter(toast => toast.id !== action.payload);
    },
    clearToasts: state => {
      state.toasts = [];
    },
    openModal: (state, action: PayloadAction<{ id: string; data?: any }>) => {
      state.modals[action.payload.id] = {
        id: action.payload.id,
        isOpen: true,
        data: action.payload.data,
      };
    },
    closeModal: (state, action: PayloadAction<string>) => {
      if (state.modals[action.payload]) {
        state.modals[action.payload].isOpen = false;
      }
    },
    setLoading: (state, action: PayloadAction<{ key: string; loading: boolean }>) => {
      state.loading[action.payload.key] = action.payload.loading;
    },
    toggleSidebar: state => {
      state.sidebarOpen = !state.sidebarOpen;
    },
  },
});

export const {
  showToast,
  hideToast,
  clearToasts,
  openModal,
  closeModal,
  setLoading,
  toggleSidebar,
} = uiSlice.actions;

export default uiSlice.reducer;
