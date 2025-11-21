import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Material } from '../types/models';

interface MaterialsState {
  materials: Material[];
  ingredients: Material[];
  equipment: Material[];
  selectedMaterial: Material | null;
  loading: boolean;
  error: string | null;
}

const initialState: MaterialsState = {
  materials: [],
  ingredients: [],
  equipment: [],
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
      state.ingredients = action.payload.filter((m) => m.type === 'INGREDIENT');
      state.equipment = action.payload.filter((m) => m.type === 'EQUIPMENT');
      state.loading = false;
      state.error = null;
    },
    setSelectedMaterial: (state, action: PayloadAction<Material | null>) => {
      state.selectedMaterial = action.payload;
    },
    addMaterial: (state, action: PayloadAction<Material>) => {
      state.materials.push(action.payload);
      if (action.payload.type === 'INGREDIENT') {
        state.ingredients.push(action.payload);
      } else if (action.payload.type === 'EQUIPMENT') {
        state.equipment.push(action.payload);
      }
    },
    updateMaterial: (state, action: PayloadAction<Material>) => {
      const index = state.materials.findIndex((m) => m.id === action.payload.id);
      if (index !== -1) {
        const oldType = state.materials[index].type;
        state.materials[index] = action.payload;

        // Update type-specific arrays
        if (oldType !== action.payload.type) {
          // Remove from old type array
          if (oldType === 'INGREDIENT') {
            state.ingredients = state.ingredients.filter((m) => m.id !== action.payload.id);
          } else if (oldType === 'EQUIPMENT') {
            state.equipment = state.equipment.filter((m) => m.id !== action.payload.id);
          }

          // Add to new type array
          if (action.payload.type === 'INGREDIENT') {
            state.ingredients.push(action.payload);
          } else if (action.payload.type === 'EQUIPMENT') {
            state.equipment.push(action.payload);
          }
        } else {
          // Update within same type array
          if (action.payload.type === 'INGREDIENT') {
            const ingIndex = state.ingredients.findIndex((m) => m.id === action.payload.id);
            if (ingIndex !== -1) {
              state.ingredients[ingIndex] = action.payload;
            }
          } else if (action.payload.type === 'EQUIPMENT') {
            const eqIndex = state.equipment.findIndex((m) => m.id === action.payload.id);
            if (eqIndex !== -1) {
              state.equipment[eqIndex] = action.payload;
            }
          }
        }
      }

      if (state.selectedMaterial?.id === action.payload.id) {
        state.selectedMaterial = action.payload;
      }
    },
    deleteMaterial: (state, action: PayloadAction<number>) => {
      const material = state.materials.find((m) => m.id === action.payload);
      state.materials = state.materials.filter((m) => m.id !== action.payload);

      if (material?.type === 'INGREDIENT') {
        state.ingredients = state.ingredients.filter((m) => m.id !== action.payload);
      } else if (material?.type === 'EQUIPMENT') {
        state.equipment = state.equipment.filter((m) => m.id !== action.payload);
      }

      if (state.selectedMaterial?.id === action.payload) {
        state.selectedMaterial = null;
      }
    },
    clearMaterials: (state) => {
      state.materials = [];
      state.ingredients = [];
      state.equipment = [];
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
