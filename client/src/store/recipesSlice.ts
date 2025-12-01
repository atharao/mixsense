import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Recipe } from '../types/models';

interface RecipesState {
  recipes: Recipe[];
  selectedRecipe: Recipe | null;
  loading: boolean;
  error: string | null;
}

const initialState: RecipesState = {
  recipes: [],
  selectedRecipe: null,
  loading: false,
  error: null,
};

const recipesSlice = createSlice({
  name: 'recipes',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setRecipes: (state, action: PayloadAction<Recipe[]>) => {
      state.recipes = action.payload;
      state.loading = false;
      state.error = null;
    },
    setSelectedRecipe: (state, action: PayloadAction<Recipe | null>) => {
      state.selectedRecipe = action.payload;
    },
    addRecipe: (state, action: PayloadAction<Recipe>) => {
      state.recipes.unshift(action.payload);
    },
    updateRecipe: (state, action: PayloadAction<Recipe>) => {
      const index = state.recipes.findIndex(r => r.id === action.payload.id);
      if (index !== -1) {
        state.recipes[index] = action.payload;
      }
      if (state.selectedRecipe?.id === action.payload.id) {
        state.selectedRecipe = action.payload;
      }
    },
    deleteRecipe: (state, action: PayloadAction<number>) => {
      state.recipes = state.recipes.filter(r => r.id !== action.payload);
      if (state.selectedRecipe?.id === action.payload) {
        state.selectedRecipe = null;
      }
    },
    clearRecipes: state => {
      state.recipes = [];
      state.selectedRecipe = null;
      state.loading = false;
      state.error = null;
    },
  },
});

export const {
  setLoading,
  setError,
  setRecipes,
  setSelectedRecipe,
  addRecipe,
  updateRecipe,
  deleteRecipe,
  clearRecipes,
} = recipesSlice.actions;

export default recipesSlice.reducer;
