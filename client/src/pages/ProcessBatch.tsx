import React, { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import { RootState } from '../store';
import { recipesApi } from '../api/recipes.api';
import { batchesApi } from '../api/batches.api';
import { useWebSocket } from '../hooks/useWebSocket';
import { setRecipes } from '../store/recipesSlice';
import { printLabel, formatQRData } from '../services/zplPrinter';
import { Recipe } from '../types/models';

interface ProcessBatchState {
  activeBatch: any | null;
  currentRecipe: Recipe | null;
  currentStepIndex: number;
  completedSteps: number[];
  currentQRCode: string | null; // Temporary QR code for current step
}

const ProcessBatch: React.FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { recipes } = useSelector((state: RootState) => state.recipes);

  const [selectedRecipeId, setSelectedRecipeId] = useState<number>(0);
  const [isStarting, setIsStarting] = useState(false);
  const [isProcessingStep, setIsProcessingStep] = useState(false);
  const [isAborting, setIsAborting] = useState(false);

  const [processBatch, setProcessBatch] = useState<ProcessBatchState>({
    activeBatch: null,
    currentRecipe: null,
    currentStepIndex: 0,
    completedSteps: [],
    currentQRCode: null,
  });

  const { isConnected, error: wsError, currentWeight, isStable } = useWebSocket();

  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    loadRecipes();
    checkForActiveBatch();
  }, []);

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
        const completedStepIds = activeBatch.logs?.map(log => log.stepId) || [];

        // Find current step index
        const currentStepIndex =
          recipe.steps?.findIndex(step => !completedStepIds.includes(step.id)) || 0;

        setProcessBatch({
          activeBatch,
          currentRecipe: recipe,
          currentStepIndex: currentStepIndex >= 0 ? currentStepIndex : 0,
          completedSteps: completedStepIds,
          currentQRCode: null,
        });

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

    if (!isConnected) {
      alert('WebSocket connection not established. Please wait...');
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
        currentQRCode: null,
      });

      setIsStarting(false);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to start process batch');
      setIsStarting(false);
    }
  };

  const generateQRCodeImage = async (qrData: string): Promise<string> => {
    try {
      // Generate QR code as data URL
      const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
        width: 300,
        margin: 2,
      });
      return qrCodeDataUrl;
    } catch (error) {
      console.error('Error generating QR code:', error);
      throw error;
    }
  };

  const handleNextStep = async () => {
    if (!processBatch.activeBatch || !processBatch.currentRecipe) return;

    const currentStep = processBatch.currentRecipe.steps?.[processBatch.currentStepIndex];
    if (!currentStep) return;

    if (currentWeight === null) {
      alert('No weight data available from WebSocket');
      return;
    }

    // Check if weight is within tolerance
    const setpoint = Number(currentStep.setpoint);
    const tolerance = Number(currentStep.tolerancePercent);
    const toleranceRange = (setpoint * tolerance) / 100;
    const lowerBound = setpoint - toleranceRange;
    const upperBound = setpoint + toleranceRange;
    const withinTolerance = currentWeight >= lowerBound && currentWeight <= upperBound;

    if (!withinTolerance) {
      const proceed = confirm(
        `Warning: Weight ${currentWeight.toFixed(2)} KG is not within tolerance range ${lowerBound.toFixed(2)} - ${upperBound.toFixed(2)} KG. Do you want to proceed anyway?`,
      );
      if (!proceed) return;
    }

    try {
      setIsProcessingStep(true);

      // Format QR data: Saumya|step|material|weight
      const qrData = formatQRData(
        currentStep.stepOrder,
        currentStep.material!.code,
        currentStep.material!.name,
        currentWeight,
      );

      // Generate QR code image for display
      const qrCodeImage = await generateQRCodeImage(qrData);
      setProcessBatch(prev => ({ ...prev, currentQRCode: qrCodeImage }));

      // Print label via ZPL API
      await printLabel({
        materialName: currentStep.material!.name,
        weight: currentWeight,
        qrData: qrData,
      });

      // Log the step to backend after successful print
      await batchesApi.logProcessStep(processBatch.activeBatch.id, {
        stepId: currentStep.id,
        materialId: currentStep.materialId,
        actualWeight: currentWeight,
        setpointSnapshot: setpoint,
        toleranceSnapshot: tolerance,
        generatedQrCode: qrData, // Store QR data string, not image
      });

      // Update state - move to next step
      const newCompletedSteps = [...processBatch.completedSteps, currentStep.id];
      const nextStepIndex = processBatch.currentStepIndex + 1;

      setProcessBatch({
        ...processBatch,
        completedSteps: newCompletedSteps,
        currentStepIndex: nextStepIndex,
        currentQRCode: null, // Clear QR after moving to next step
      });

      setIsProcessingStep(false);

      // Check if all steps are completed
      if (nextStepIndex >= (processBatch.currentRecipe.steps?.length || 0)) {
        // Show summary screen
        showSummaryScreen();
      }
    } catch (error: any) {
      alert(error.message || 'Failed to process step');
      setIsProcessingStep(false);
      setProcessBatch(prev => ({ ...prev, currentQRCode: null }));
    }
  };

  const handleAbortBatch = async () => {
    if (!processBatch.activeBatch) return;

    if (!confirm('Are you sure you want to abort this batch? All progress will be lost.')) {
      return;
    }

    try {
      setIsAborting(true);
      await batchesApi.end(processBatch.activeBatch.id, { status: 'ABORTED' });

      // Reset state
      setProcessBatch({
        activeBatch: null,
        currentRecipe: null,
        currentStepIndex: 0,
        completedSteps: [],
        currentQRCode: null,
      });

      setIsAborting(false);
      alert('Batch aborted successfully');
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to abort batch');
      setIsAborting(false);
    }
  };

  const showSummaryScreen = () => {
    // Navigate to summary with batch data
    const summaryData = {
      batchId: processBatch.activeBatch.id,
      recipeName: processBatch.currentRecipe!.name,
      completedSteps: processBatch.completedSteps.length,
      totalSteps: processBatch.currentRecipe!.steps?.length || 0,
    };

    // Store in session storage for summary page
    sessionStorage.setItem('batchSummary', JSON.stringify(summaryData));
    navigate('/batch-summary');
  };

  const currentStep = processBatch.currentRecipe?.steps?.[processBatch.currentStepIndex];

  // Calculate tolerance values for current step
  let withinTolerance = false;
  let lowerBound = 0;
  let upperBound = 0;
  if (currentStep && currentWeight !== null) {
    const setpoint = Number(currentStep.setpoint);
    const tolerance = Number(currentStep.tolerancePercent);
    const toleranceRange = (setpoint * tolerance) / 100;
    lowerBound = setpoint - toleranceRange;
    upperBound = setpoint + toleranceRange;
    withinTolerance = currentWeight >= lowerBound && currentWeight <= upperBound;
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Process Batch</h1>

      {/* WebSocket Connection Status */}
      <div className="mb-6 bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Node-RED Weight Monitor</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Status:</span>
            <span
              className={`px-3 py-1 rounded ${
                isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}
            >
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          {isConnected && (
            <div className="flex items-center gap-2">
              <span className="font-semibold">Current Weight:</span>
              <span
                className={`px-3 py-1 rounded text-xl font-bold ${
                  isStable ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                {currentWeight !== null ? currentWeight.toFixed(2) : '0.00'} KG
                {isStable && ' (Stable)'}
              </span>
            </div>
          )}

          {wsError && <div className="text-red-600">Error: {wsError}</div>}
        </div>
      </div>

      {/* Recipe Selection */}
      {!processBatch.activeBatch && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Start Process Batch</h2>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Select Recipe</label>
            <select
              value={selectedRecipeId}
              onChange={e => setSelectedRecipeId(Number(e.target.value))}
              className="w-full p-2 border rounded"
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
            disabled={isStarting || !selectedRecipeId || !isConnected}
            className="w-full py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300"
          >
            {isStarting ? 'Starting...' : 'Start Process Batch'}
          </button>
        </div>
      )}

      {/* Active Process Batch */}
      {processBatch.activeBatch && processBatch.currentRecipe && (
        <div className="space-y-6">
          {/* Recipe Info & Progress */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl font-semibold">{processBatch.currentRecipe.name}</h2>
              <button
                onClick={handleAbortBatch}
                disabled={isAborting}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-300"
              >
                {isAborting ? 'Aborting...' : 'Abort Batch'}
              </button>
            </div>
            <p className="text-gray-600">
              Step {processBatch.currentStepIndex + 1} of{' '}
              {processBatch.currentRecipe.steps?.length || 0}
            </p>
            <div className="mt-2">
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-green-500 h-3 rounded-full transition-all"
                  style={{
                    width: `${(processBatch.completedSteps.length / (processBatch.currentRecipe.steps?.length || 1)) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* All Steps Display */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Recipe Steps</h3>
            <div className="space-y-3">
              {processBatch.currentRecipe.steps?.map((step, index) => {
                const isCurrentStep = index === processBatch.currentStepIndex;
                const isCompleted = processBatch.completedSteps.includes(step.id);

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
                              ✓ Completed
                            </span>
                          )}
                          {isCurrentStep && (
                            <span className="px-2 py-1 bg-blue-200 text-blue-800 rounded text-xs">
                              → Current
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

                <div className="mb-4">
                  <div
                    className={`p-6 rounded-lg text-center ${
                      withinTolerance
                        ? 'bg-green-100 border-2 border-green-500'
                        : 'bg-yellow-100 border-2 border-yellow-500'
                    }`}
                  >
                    <p className="text-sm text-gray-600 mb-1">Actual Weight</p>
                    <p className="text-4xl font-bold">
                      {currentWeight !== null ? currentWeight.toFixed(2) : '0.00'} KG
                    </p>
                    <p className="text-sm mt-2">
                      Target: {Number(currentStep.setpoint).toFixed(2)} KG (±
                      {Number(currentStep.tolerancePercent)}%)
                    </p>
                    <p className="text-sm text-gray-600">
                      Acceptable: {lowerBound.toFixed(2)} - {upperBound.toFixed(2)} KG
                    </p>
                    {withinTolerance && (
                      <p className="text-green-600 font-semibold mt-2">✓ Within Tolerance</p>
                    )}
                    {!withinTolerance && currentWeight !== null && (
                      <p className="text-yellow-600 font-semibold mt-2">
                        ⚠ Outside Tolerance Range
                      </p>
                    )}
                  </div>
                </div>

                {/* QR Code Display (Temporary) */}
                {processBatch.currentQRCode && (
                  <div className="mb-4 p-4 bg-gray-50 rounded-lg text-center">
                    <p className="text-sm text-gray-600 mb-2">Generated QR Code</p>
                    <img src={processBatch.currentQRCode} alt="QR Code" className="mx-auto" />
                    <p className="text-xs text-gray-500 mt-2">Printing to label...</p>
                  </div>
                )}

                <button
                  onClick={handleNextStep}
                  disabled={isProcessingStep || currentWeight === null}
                  className="w-full py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 font-semibold text-lg"
                >
                  {isProcessingStep ? 'Processing & Printing Label...' : 'NEXT ➔'}
                </button>
              </div>
            )}
        </div>
      )}

      {/* Hidden canvas for QR code generation */}
      <canvas ref={qrCanvasRef} style={{ display: 'none' }} />
    </div>
  );
};

export default ProcessBatch;
