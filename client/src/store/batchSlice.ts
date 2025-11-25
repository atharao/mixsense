import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Batch, BatchLog, Recipe } from '../types/models';

interface LoadCellData {
  weight: number | null;
  isStable: boolean;
  timestamp: number;
}

interface BatchState {
  activeBatch: Batch | null;
  currentRecipe: Recipe | null;
  currentStepIndex: number;
  loadCellData: LoadCellData;
  scannedQRCode: string | null;
  localHistory: BatchLog[];
  isWithinTolerance: boolean;
  isQRValidated: boolean;
}

const initialState: BatchState = {
  activeBatch: null,
  currentRecipe: null,
  currentStepIndex: 0,
  loadCellData: {
    weight: null,
    isStable: false,
    timestamp: 0,
  },
  scannedQRCode: null,
  localHistory: [],
  isWithinTolerance: false,
  isQRValidated: false,
};

const batchSlice = createSlice({
  name: 'batch',
  initialState,
  reducers: {
    startBatch: (state, action: PayloadAction<{ batch: Batch; recipe: Recipe }>) => {
      state.activeBatch = action.payload.batch;
      state.currentRecipe = action.payload.recipe;
      state.currentStepIndex = 0;
      state.localHistory = [];
      state.scannedQRCode = null;
      state.isQRValidated = false;
      state.isWithinTolerance = false;
    },
    endBatch: state => {
      state.activeBatch = null;
      state.currentRecipe = null;
      state.currentStepIndex = 0;
      state.localHistory = [];
      state.scannedQRCode = null;
      state.isQRValidated = false;
      state.isWithinTolerance = false;
      state.loadCellData = {
        weight: null,
        isStable: false,
        timestamp: 0,
      };
    },
    nextStep: state => {
      if (state.currentRecipe && state.currentStepIndex < state.currentRecipe.steps!.length - 1) {
        state.currentStepIndex += 1;
        state.scannedQRCode = null;
        state.isQRValidated = false;
        state.isWithinTolerance = false;
      }
    },
    setCurrentStep: (state, action: PayloadAction<number>) => {
      state.currentStepIndex = action.payload;
      state.scannedQRCode = null;
      state.isQRValidated = false;
      state.isWithinTolerance = false;
    },
    updateLoadCellData: (state, action: PayloadAction<LoadCellData>) => {
      state.loadCellData = action.payload;

      // Check tolerance if we have a current step
      if (state.currentRecipe && state.currentRecipe.steps) {
        const currentStep = state.currentRecipe.steps[state.currentStepIndex];
        if (currentStep && action.payload.weight !== null) {
          const setpoint = Number(currentStep.setpoint);
          const tolerance = Number(currentStep.tolerancePercent);
          const weight = action.payload.weight;

          const toleranceRange = (setpoint * tolerance) / 100;
          const lowerBound = setpoint - toleranceRange;
          const upperBound = setpoint + toleranceRange;

          state.isWithinTolerance = weight >= lowerBound && weight <= upperBound;
        }
      }
    },
    setScannedQRCode: (state, action: PayloadAction<string>) => {
      state.scannedQRCode = action.payload;
    },
    setQRValidated: (state, action: PayloadAction<boolean>) => {
      state.isQRValidated = action.payload;
    },
    addLogEntry: (state, action: PayloadAction<BatchLog>) => {
      state.localHistory.push(action.payload);
    },
    clearBatchState: _state => {
      return initialState;
    },
  },
});

export const {
  startBatch,
  endBatch,
  nextStep,
  setCurrentStep,
  updateLoadCellData,
  setScannedQRCode,
  setQRValidated,
  addLogEntry,
  clearBatchState,
} = batchSlice.actions;

export default batchSlice.reducer;
