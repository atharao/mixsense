import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { recipesApi } from '../api/recipes.api';
import { batchesApi } from '../api/batches.api';
import { useBarcodeScanner, BarcodeData } from '../hooks/useBarcodeScanner';
import { setRecipes } from '../store/recipesSlice';
import { Recipe } from '../types/models';
import StepProgressIndicator from '../components/StepProgressIndicator';

interface ProcessBatchState {
  activeBatch: any | null;
  currentRecipe: Recipe | null;
  currentStepIndex: number;
  completedSteps: number[];
}

const ProcessBatch: React.FC = () => {
  const dispatch = useDispatch();
  const { recipes } = useSelector((state: RootState) => state.recipes);
  const { user } = useSelector((state: RootState) => state.auth);

  const [selectedRecipeId, setSelectedRecipeId] = useState<number>(0);
  const [isStarting, setIsStarting] = useState(false);
  const [isProcessingStep, setIsProcessingStep] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isAborting, setIsAborting] = useState(false);

  const [processBatch, setProcessBatch] = useState<ProcessBatchState>({
    activeBatch: null,
    currentRecipe: null,
    currentStepIndex: 0,
    completedSteps: [],
  });

  // Use barcode scanner with manual connection control (no auto-connect)
  const {
    isConnected,
    hasDataReceived,
    error: wsError,
    lastScannedBarcode,
    clearLastBarcode,
    connect,
    disconnect,
  } = useBarcodeScanner(undefined, { autoConnect: false });

  useEffect(() => {
    console.log('🟢 ProcessBatch component mounted');
    loadRecipes();
    checkForActiveBatch();

    // Cleanup: disconnect WebSocket when component unmounts or user navigates away
    return () => {
      console.log('🔴 ProcessBatch component unmounting - disconnecting barcode WebSocket');
      disconnect();
    };
  }, []); // Run only once on mount, disconnect on unmount

  // Handle barcode scan
  useEffect(() => {
    if (lastScannedBarcode && processBatch.activeBatch && processBatch.currentRecipe) {
      handleBarcodeScanned(lastScannedBarcode);
    }
  }, [lastScannedBarcode]);

  const checkForActiveBatch = async () => {
    try {
      const response = await batchesApi.getActive();
      if (response.data.data) {
        const activeBatch = response.data.data;
        console.log('Found active batch:', activeBatch);

        // Load the recipe details
        const recipeResponse = await recipesApi.getById(activeBatch.recipeId);
        const recipe = recipeResponse.data.data!;

        // Calculate which steps are already completed
        const completedStepIndices: number[] = [];
        activeBatch.logs?.forEach(log => {
          const stepIndex = recipe.steps?.findIndex(s => s.id === log.stepId);
          if (stepIndex !== undefined && stepIndex >= 0) {
            completedStepIndices.push(stepIndex);
          }
        });

        // Find current step index
        const currentStepIndex =
          recipe.steps?.findIndex((_, index) => !completedStepIndices.includes(index)) || 0;

        setProcessBatch({
          activeBatch,
          currentRecipe: recipe,
          currentStepIndex: currentStepIndex >= 0 ? currentStepIndex : 0,
          completedSteps: completedStepIndices,
        });

        // Connect to barcode scanner WebSocket for active batch
        console.log('🟢 ProcessBatch: Connecting to barcode scanner for active batch');
        connect();

        alert('Resuming active batch: ' + recipe.name);
      }
    } catch (error) {
      console.log('No active batch found or error:', error);
    }
  };

  const loadRecipes = async () => {
    try {
      const response = await recipesApi.getAll();
      dispatch(setRecipes(response.data.data || []));
    } catch (error) {
      console.error('Error loading recipes:', error);
    }
  };

  const handleStartProcessBatch = async () => {
    if (!selectedRecipeId) {
      alert('Please select a recipe');
      return;
    }

    if (!user) {
      alert('User not authenticated');
      return;
    }

    try {
      setIsStarting(true);
      const response = await batchesApi.startProcess({ recipeId: selectedRecipeId });
      const batch = response.data.data!;

      // Load full recipe details
      const recipeResponse = await recipesApi.getById(selectedRecipeId);
      const recipe = recipeResponse.data.data!;

      setProcessBatch({
        activeBatch: batch,
        currentRecipe: recipe,
        currentStepIndex: 0,
        completedSteps: [],
      });

      // Connect to barcode scanner WebSocket when batch starts
      console.log('🟢 ProcessBatch: Calling connect() because user clicked Start Process Batch');
      connect();

      setIsStarting(false);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to start process batch');
      setIsStarting(false);
    }
  };

  const handleBarcodeScanned = async (barcodeData: BarcodeData) => {
    if (isProcessingStep) {
      console.log('Already processing a step, ignoring barcode');
      return;
    }

    if (!processBatch.currentRecipe || !processBatch.activeBatch) {
      alert('No active batch');
      clearLastBarcode();
      return;
    }

    const currentStep = processBatch.currentRecipe.steps?.[processBatch.currentStepIndex];
    if (!currentStep) {
      alert('No current step found');
      clearLastBarcode();
      return;
    }

    // Validate barcode data matches current step
    console.log('🔍 Validating barcode data...');
    console.log('📦 Received barcode data:', barcodeData);
    console.log('📋 Current step:', currentStep);

    // Validation 1: Check Recipe ID
    if (barcodeData.recipeId !== processBatch.currentRecipe.id) {
      alert(
        `❌ Wrong recipe!\n\nExpected Recipe ID: ${processBatch.currentRecipe.id} (${processBatch.currentRecipe.name})\nScanned Recipe ID: ${barcodeData.recipeId}\n\nPlease scan the correct packet for this recipe.`,
      );
      clearLastBarcode();
      return;
    }

    // Validation 2: Check Step ID
    if (barcodeData.stepId !== currentStep.id) {
      alert(
        `❌ Wrong step!\n\nExpected Step: ${currentStep.stepOrder} (${currentStep.material?.name})\nStep ID: ${currentStep.id}\n\nScanned Step ID: ${barcodeData.stepId}\n\nPlease scan the packet for the current step.`,
      );
      clearLastBarcode();
      return;
    }

    // Validation 3: Check Material Code
    if (barcodeData.materialCode !== currentStep.material?.code) {
      alert(
        `❌ Wrong material!\n\nExpected Material: ${currentStep.material?.name} (${currentStep.material?.code})\nScanned Material Code: ${barcodeData.materialCode}\n\nPlease scan the correct material packet.`,
      );
      clearLastBarcode();
      return;
    }

    // All validations passed
    console.log('✅ Barcode validation successful - all checks passed');

    try {
      setIsProcessingStep(true);

      // Get setpoint and tolerance from current step (not from barcode)
      const setpoint = Number(currentStep.setpoint);
      const tolerance = Number(currentStep.tolerancePercent);

      // Create the full QR data string for storage (6-field format)
      const qrDataString = `${barcodeData.recipeId}|${barcodeData.stepId}|${barcodeData.materialCode}|${barcodeData.actualWeight}|${barcodeData.userId}|${barcodeData.timestamp}`;

      console.log('📤 Sending to backend:', {
        stepId: currentStep.id,
        materialId: currentStep.materialId,
        actualWeight: barcodeData.actualWeight,
        setpointSnapshot: setpoint,
        toleranceSnapshot: tolerance,
        scannedQrCode: qrDataString,
        generatedQrCode: qrDataString, // Using scanned QR data for both fields
      });

      // Log the step to backend
      await batchesApi.logProcessStep(processBatch.activeBatch.id, {
        stepId: currentStep.id,
        materialId: currentStep.materialId,
        actualWeight: barcodeData.actualWeight,
        setpointSnapshot: setpoint,
        toleranceSnapshot: tolerance,
        scannedQrCode: qrDataString,
        generatedQrCode: qrDataString, // Using scanned QR data since we're scanning pre-generated codes
      });

      // Update state - move to next step
      const newCompletedSteps = [...processBatch.completedSteps, processBatch.currentStepIndex];
      const nextStepIndex = processBatch.currentStepIndex + 1;

      setProcessBatch({
        ...processBatch,
        completedSteps: newCompletedSteps,
        currentStepIndex: nextStepIndex,
      });

      clearLastBarcode();
      setIsProcessingStep(false);

      // Check if all steps are completed
      if (nextStepIndex >= (processBatch.currentRecipe.steps?.length || 0)) {
        // All steps completed, show completion option
        const shouldComplete = confirm(
          'All steps completed! Do you want to mark this batch as PROCESSED?',
        );
        if (shouldComplete) {
          await handleCompleteBatch();
        }
      }
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to log step');
      setIsProcessingStep(false);
      clearLastBarcode();
    }
  };

  const handleCompleteBatch = async () => {
    if (!processBatch.activeBatch) return;

    try {
      setIsCompleting(true);
      await batchesApi.completeProcess(processBatch.activeBatch.id);

      alert('Batch completed successfully!');

      // Disconnect barcode scanner WebSocket when batch completes
      console.log('🔴 ProcessBatch: Disconnecting barcode scanner - batch completed');
      disconnect();

      // Reset state
      setProcessBatch({
        activeBatch: null,
        currentRecipe: null,
        currentStepIndex: 0,
        completedSteps: [],
      });
      setSelectedRecipeId(0);

      setIsCompleting(false);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to complete batch');
      setIsCompleting(false);
    }
  };

  const handleAbortBatch = async () => {
    if (!processBatch.activeBatch) return;

    const confirmAbort = confirm(
      `Are you sure you want to abort this batch?\n\nRecipe: ${processBatch.currentRecipe?.name}\nCompleted Steps: ${processBatch.completedSteps.length}/${processBatch.currentRecipe?.steps?.length || 0}\n\nThis action cannot be undone.`,
    );

    if (!confirmAbort) return;

    try {
      setIsAborting(true);
      await batchesApi.abortProcess(processBatch.activeBatch.id);

      alert('Batch aborted successfully.');

      // Disconnect barcode scanner WebSocket when batch is aborted
      console.log('🔴 ProcessBatch: Disconnecting barcode scanner - batch aborted');
      disconnect();

      // Reset state
      setProcessBatch({
        activeBatch: null,
        currentRecipe: null,
        currentStepIndex: 0,
        completedSteps: [],
      });
      setSelectedRecipeId(0);

      setIsAborting(false);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to abort batch');
      setIsAborting(false);
    }
  };

  const currentStep = processBatch.currentRecipe?.steps?.[processBatch.currentStepIndex];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Process Batch</h2>
        <p className="text-gray-500">
          Scan barcoded packets to log material usage into the system.
        </p>
      </div>

      {/* Barcode Scanner Connection Status - Only show when batch is active */}
      {processBatch.activeBatch && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Barcode Scanner Monitor</h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Status:</span>
              <span
                className={`px-3 py-1 rounded ${
                  hasDataReceived ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {hasDataReceived
                  ? 'CONNECTED'
                  : isConnected
                    ? 'Waiting for scan...'
                    : 'Disconnected'}
              </span>
            </div>

            {lastScannedBarcode && (
              <div className="flex items-center gap-2">
                <span className="font-semibold">Last Scanned:</span>
                <span className="px-3 py-1 rounded bg-blue-100 text-blue-800 text-sm">
                  {lastScannedBarcode.materialCode} - {lastScannedBarcode.actualWeight.toFixed(2)}{' '}
                  KG
                </span>
              </div>
            )}

            {wsError && <div className="text-red-600">Error: {wsError}</div>}
          </div>
        </div>
      )}

      {/* Recipe Selection */}
      {!processBatch.activeBatch && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Start Process Batch</h2>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Select Recipe</label>
            <select
              value={selectedRecipeId}
              onChange={e => setSelectedRecipeId(Number(e.target.value))}
              className="input"
            >
              <option value={0}>-- Select a recipe --</option>
              {recipes.map((recipe: any) => (
                <option key={recipe.id} value={recipe.id}>
                  {recipe.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleStartProcessBatch}
            disabled={isStarting || !selectedRecipeId}
            className="w-full py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300"
          >
            {isStarting ? 'Starting...' : 'Start Process Batch'}
          </button>
        </div>
      )}

      {/* Active Process Batch */}
      {processBatch.activeBatch && processBatch.currentRecipe && (
        <div className="space-y-6">
          {/* Recipe Info with Abort Button */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex-1">
                <h2 className="text-xl font-semibold mb-2">{processBatch.currentRecipe.name}</h2>
                <p className="text-gray-600">
                  Step {processBatch.currentStepIndex + 1} of{' '}
                  {processBatch.currentRecipe.steps?.length || 0}
                </p>
              </div>
              <button
                onClick={handleAbortBatch}
                disabled={isAborting || isCompleting}
                className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:bg-gray-300 font-semibold transition-colors"
              >
                {isAborting ? 'Aborting...' : 'Abort Batch'}
              </button>
            </div>
          </div>

          {/* Step Progress Indicator */}
          <div className="bg-white rounded-lg shadow p-6">
            <StepProgressIndicator
              totalSteps={processBatch.currentRecipe.steps?.length || 0}
              currentStepIndex={processBatch.currentStepIndex}
              completedSteps={processBatch.completedSteps}
            />
          </div>

          {/* All Steps Display */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Recipe Steps</h3>
            <div className="space-y-3">
              {processBatch.currentRecipe.steps?.map((step, index) => {
                const isCurrentStep = index === processBatch.currentStepIndex;
                const isCompleted = processBatch.completedSteps.includes(index);

                return (
                  <div
                    key={step.id}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      isCurrentStep
                        ? 'border-blue-500 bg-blue-50'
                        : isCompleted
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span
                            className={`text-lg font-bold ${
                              isCurrentStep
                                ? 'text-blue-600'
                                : isCompleted
                                  ? 'text-green-600'
                                  : 'text-gray-400'
                            }`}
                          >
                            Step {step.stepOrder}
                          </span>
                          {isCompleted && (
                            <span className="px-2 py-1 bg-green-200 text-green-800 rounded text-xs">
                              ✓ Scanned
                            </span>
                          )}
                          {isCurrentStep && (
                            <span className="px-2 py-1 bg-blue-200 text-blue-800 rounded text-xs">
                              → Waiting for scan
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-4 gap-4 mt-2">
                          <div>
                            <p className="text-xs text-gray-600">Material Code</p>
                            <p className="font-semibold">{step.material?.code || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600">Material Name</p>
                            <p className="font-semibold">{step.material?.name || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600">Setpoint</p>
                            <p className="font-semibold">{Number(step.setpoint).toFixed(2)} KG</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600">Tolerance</p>
                            <p className="font-semibold">±{Number(step.tolerancePercent)}%</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Current Step Controls */}
          {currentStep &&
            processBatch.currentStepIndex < (processBatch.currentRecipe.steps?.length || 0) && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4">
                  Current Step: {currentStep.material?.name || 'N/A'}
                </h3>

                <div className="p-6 rounded-lg text-center bg-blue-100 border-2 border-blue-500">
                  <div className="mb-4">
                    <svg
                      className="w-16 h-16 mx-auto text-blue-600 mb-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                      />
                    </svg>
                    <p className="text-2xl font-bold text-blue-800">
                      Scan barcode for {currentStep.material?.name}
                    </p>
                  </div>
                  <p className="text-sm text-blue-700">
                    Expected: {currentStep.material?.code} -{' '}
                    {Number(currentStep.setpoint).toFixed(2)} KG (±
                    {Number(currentStep.tolerancePercent)}%)
                  </p>
                  {isProcessingStep && (
                    <div className="mt-4 flex items-center justify-center">
                      <svg
                        className="animate-spin h-5 w-5 text-blue-600 mr-2"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      <span className="text-blue-700 font-medium">Processing barcode...</span>
                    </div>
                  )}
                </div>
              </div>
            )}

          {/* Completion Button */}
          {processBatch.currentStepIndex >= (processBatch.currentRecipe.steps?.length || 0) && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-center mb-4">
                <div className="inline-block p-3 bg-green-100 rounded-full mb-3">
                  <svg
                    className="w-12 h-12 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-green-700 mb-2">All Steps Completed!</h3>
                <p className="text-gray-600 mb-4">
                  All {processBatch.currentRecipe.steps?.length} steps have been scanned
                  successfully.
                </p>
              </div>

              <button
                onClick={handleCompleteBatch}
                disabled={isCompleting}
                className="w-full py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 font-semibold text-lg"
              >
                {isCompleting ? 'Completing...' : 'Complete Batch (Mark as PROCESSED)'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProcessBatch;
