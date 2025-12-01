import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Material } from '../types/models';

interface MaterialsState {
  materials: Material[];
  selectedMaterial: Material | null;
  loading: boolean;
  error: string | null;
}

const initialState: MaterialsState = {
  materials: [],
  selectedMaterial: null,
  loading: false,
  error: null,
};

const materialsSlice = createSlice({
  name: 'materials',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setMaterials: (state, action: PayloadAction<Material[]>) => {
      state.materials = action.payload;
      state.loading = false;
      state.error = null;
    },
    setSelectedMaterial: (state, action: PayloadAction<Material | null>) => {
      state.selectedMaterial = action.payload;
    },
    addMaterial: (state, action: PayloadAction<Material>) => {
      state.materials.unshift(action.payload);
    },
    updateMaterial: (state, action: PayloadAction<Material>) => {
      const index = state.materials.findIndex(m => m.id === action.payload.id);
      if (index !== -1) {
        state.materials[index] = action.payload;
      }

      if (state.selectedMaterial?.id === action.payload.id) {
        state.selectedMaterial = action.payload;
      }
    },
    deleteMaterial: (state, action: PayloadAction<number>) => {
      state.materials = state.materials.filter(m => m.id !== action.payload);

      if (state.selectedMaterial?.id === action.payload) {
        state.selectedMaterial = null;
      }
    },
    clearMaterials: state => {
      state.materials = [];
      state.selectedMaterial = null;
      state.loading = false;
      state.error = null;
    },
  },
});

export const {
  setLoading,
  setError,
  setMaterials,
  setSelectedMaterial,
  addMaterial,
  updateMaterial,
  deleteMaterial,
  clearMaterials,
} = materialsSlice.actions;

export default materialsSlice.reducer;
