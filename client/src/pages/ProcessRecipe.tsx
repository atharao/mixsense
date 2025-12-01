import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import QRCode from 'qrcode';
import { RootState } from '../store';
import { recipesApi } from '../api/recipes.api';
import { useWebSocket } from '../hooks/useWebSocket';
import { setRecipes } from '../store/recipesSlice';
import { printLabel, formatQRData } from '../services/zplPrinter';
import { Recipe } from '../types/models';
import StepProgressIndicator from '../components/StepProgressIndicator';
import ZplBarcodePopup from '../components/ZplBarcodePopup';

interface ProcessRecipeState {
  currentRecipe: Recipe | null;
  currentStepIndex: number;
  completedSteps: number[];
  isProcessing: boolean;
  currentQRCode: string | null;
  currentQRData: string | null; // QR data string for printing
  frozenWeight: number | null; // Frozen weight value for QR code display
}

const ProcessRecipe: React.FC = () => {
  const dispatch = useDispatch();
  const { recipes } = useSelector((state: RootState) => state.recipes);
  const { user } = useSelector((state: RootState) => state.auth);

  const [selectedRecipeId, setSelectedRecipeId] = useState<number>(0);
  const [isStarting, setIsStarting] = useState(false);

  const [processRecipe, setProcessRecipe] = useState<ProcessRecipeState>({
    currentRecipe: null,
    currentStepIndex: 0,
    completedSteps: [],
    isProcessing: false,
    currentQRCode: null,
    currentQRData: null,
    frozenWeight: null,
  });

  // Use WebSocket with manual connection control (no auto-connect)
  const {
    isConnected,
    hasDataReceived,
    error: wsError,
    currentWeight,
    isStable,
    connect,
    disconnect,
  } = useWebSocket(undefined, { autoConnect: false });

  useEffect(() => {
    console.log('🟢 ProcessRecipe component mounted');
    loadRecipes();

    // Cleanup: disconnect WebSocket when component unmounts or user navigates away
    return () => {
      console.log('🔴 ProcessRecipe component unmounting - disconnecting WebSocket');
      disconnect();
    };
  }, []); // Run only once on mount, disconnect on unmount

  const loadRecipes = async () => {
    try {
      const response = await recipesApi.getAll();
      dispatch(setRecipes(response.data.data || []));
    } catch (error) {
      console.error('Error loading recipes:', error);
    }
  };

  const handleStartProcessRecipe = async () => {
    if (!selectedRecipeId) {
      alert('Please select a recipe');
      return;
    }

    try {
      setIsStarting(true);
      const recipeResponse = await recipesApi.getById(selectedRecipeId);
      const recipe = recipeResponse.data.data!;

      setProcessRecipe({
        currentRecipe: recipe,
        currentStepIndex: 0,
        completedSteps: [],
        isProcessing: false,
        currentQRCode: null,
        currentQRData: null,
        frozenWeight: null,
      });

      // Connect to WebSocket when recipe is selected
      console.log('🟢 ProcessRecipe: Calling connect() because user clicked Start Process Recipe');
      connect();

      setIsStarting(false);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to load recipe');
      setIsStarting(false);
    }
  };

  const generateQRCodeImage = async (qrData: string): Promise<string> => {
    try {
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
    if (!processRecipe.currentRecipe || !user) return;

    const currentStep = processRecipe.currentRecipe.steps?.[processRecipe.currentStepIndex];
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
      // Freeze the current weight value for QR code generation
      const frozenWeightValue = currentWeight;

      // Format QR data with essential information using frozen weight
      const qrData = formatQRData({
        recipeId: processRecipe.currentRecipe.id,
        stepId: currentStep.id,
        materialCode: currentStep.material!.code,
        actualWeight: frozenWeightValue,
        userId: user.id,
      });

      // Generate QR code image for display
      const qrCodeImage = await generateQRCodeImage(qrData);

      // Show popup with QR code - do NOT call printer yet
      setProcessRecipe(prev => ({
        ...prev,
        currentQRCode: qrCodeImage,
        currentQRData: qrData,
        frozenWeight: frozenWeightValue,
        isProcessing: false,
      }));
    } catch (error: any) {
      alert(error.message || 'Failed to generate QR code');
      setProcessRecipe(prev => ({
        ...prev,
        isProcessing: false,
        currentQRCode: null,
        frozenWeight: null,
      }));
    }
  };

  const handlePrintLabel = async (qrData: string) => {
    const currentStep = processRecipe.currentRecipe?.steps?.[processRecipe.currentStepIndex];
    if (!currentStep || processRecipe.frozenWeight === null) {
      throw new Error('Missing step or weight data');
    }

    await printLabel({
      materialName: currentStep.material!.name,
      weight: processRecipe.frozenWeight,
      qrData: qrData,
    });
  };

  const handleProceed = () => {
    // Move to next step after user clicks Proceed
    const newCompletedSteps = [...processRecipe.completedSteps, processRecipe.currentStepIndex];
    const nextStepIndex = processRecipe.currentStepIndex + 1;

    setProcessRecipe({
      ...processRecipe,
      completedSteps: newCompletedSteps,
      currentStepIndex: nextStepIndex,
      isProcessing: false,
      currentQRCode: null,
      currentQRData: null,
      frozenWeight: null,
    });

    // Check if all steps are completed
    if (nextStepIndex >= (processRecipe.currentRecipe?.steps?.length || 0)) {
      alert('All steps completed! You can now use these packets in Process Batch.');
      // Disconnect WebSocket when process is complete
      disconnect();
      // Reset to recipe selection
      setProcessRecipe({
        currentRecipe: null,
        currentStepIndex: 0,
        completedSteps: [],
        isProcessing: false,
        currentQRCode: null,
        currentQRData: null,
        frozenWeight: null,
      });
      setSelectedRecipeId(0);
    }
  };

  const currentStep = processRecipe.currentRecipe?.steps?.[processRecipe.currentStepIndex];

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
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Process Recipe</h2>
        <p className="text-gray-500">
          Fill raw materials into packets, print barcodes, and stick them on packets for later use
          in Process Batch.
        </p>
      </div>

      {/* WebSocket Connection Status - Only show when recipe is selected */}
      {processRecipe.currentRecipe && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Weight Monitor</h2>
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
                    ? 'Waiting for data...'
                    : 'Disconnected'}
              </span>
            </div>

            {hasDataReceived && (
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
      )}

      {/* Recipe Selection */}
      {!processRecipe.currentRecipe && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Start Process Recipe</h2>

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
            onClick={handleStartProcessRecipe}
            disabled={isStarting || !selectedRecipeId}
            className="w-full py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300"
          >
            {isStarting ? 'Loading Recipe...' : 'Start Process Recipe'}
          </button>
        </div>
      )}

      {/* Active Process Recipe */}
      {processRecipe.currentRecipe && (
        <div className="space-y-6">
          {/* Recipe Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-2">{processRecipe.currentRecipe.name}</h2>
            <p className="text-gray-600">
              Step {processRecipe.currentStepIndex + 1} of{' '}
              {processRecipe.currentRecipe.steps?.length || 0}
            </p>
          </div>

          {/* Step Progress Indicator */}
          <div className="bg-white rounded-lg shadow p-6">
            <StepProgressIndicator
              totalSteps={processRecipe.currentRecipe.steps?.length || 0}
              currentStepIndex={processRecipe.currentStepIndex}
              completedSteps={processRecipe.completedSteps}
            />
          </div>

          {/* All Steps Display */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Recipe Steps</h3>
            <div className="space-y-3">
              {processRecipe.currentRecipe.steps?.map((step, index) => {
                const isCurrentStep = index === processRecipe.currentStepIndex;
                const isCompleted = processRecipe.completedSteps.includes(index);

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
            processRecipe.currentStepIndex < (processRecipe.currentRecipe.steps?.length || 0) && (
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

                <button
                  onClick={handleNextStep}
                  disabled={
                    processRecipe.isProcessing || currentWeight === null || !hasDataReceived
                  }
                  className="w-full py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 font-semibold text-lg"
                >
                  NEXT ➔
                </button>
              </div>
            )}
        </div>
      )}

      {/* ZPL Barcode Popup */}
      {processRecipe.currentQRCode && processRecipe.currentQRData && currentStep && (
        <ZplBarcodePopup
          qrCodeImage={processRecipe.currentQRCode}
          materialName={currentStep.material?.name || 'Unknown'}
          weight={processRecipe.frozenWeight || 0}
          qrData={processRecipe.currentQRData}
          onPrint={handlePrintLabel}
          onProceed={handleProceed}
        />
      )}
    </div>
  );
};

export default ProcessRecipe;
