import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { recipesApi } from '../api/recipes.api';
import { batchesApi } from '../api/batches.api';
import { qrApi } from '../api/qr.api';
import { useLoadCell } from '../hooks/useLoadCell';
import { setRecipes } from '../store/recipesSlice';

interface ProcessBatchState {
  activeBatch: any | null;
  currentRecipe: any | null;
  currentStepIndex: number;
  processedSteps: Set<number>;
  generatedQRCodes: Map<number, string>; // stepId -> QR code image
}

const ProcessBatch: React.FC = () => {
  const dispatch = useDispatch();
  const { recipes } = useSelector((state: RootState) => state.recipes);

  const [selectedRecipeId, setSelectedRecipeId] = useState<number>(0);
  const [isStarting, setIsStarting] = useState(false);
  const [isLoggingStep, setIsLoggingStep] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  const [processBatch, setProcessBatch] = useState<ProcessBatchState>({
    activeBatch: null,
    currentRecipe: null,
    currentStepIndex: 0,
    processedSteps: new Set(),
    generatedQRCodes: new Map(),
  });

  const { isConnected, error: loadCellError, currentWeight, isStable, connect, disconnect, tare } = useLoadCell();

  useEffect(() => {
    loadRecipes();

    return () => {
      disconnect();
    };
  }, []);

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
      alert('Please connect to the load cell first');
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
        processedSteps: new Set(),
        generatedQRCodes: new Map(),
      });

      setIsStarting(false);
      alert('Process batch started successfully!');
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to start process batch');
      setIsStarting(false);
    }
  };

  const handleLogStep = async () => {
    if (!processBatch.activeBatch || !processBatch.currentRecipe) return;

    const currentStep = processBatch.currentRecipe.steps[processBatch.currentStepIndex];
    if (!currentStep) return;

    if (currentWeight === null) {
      alert('No weight data available');
      return;
    }

    // Check if weight is within tolerance
    const setpoint = currentStep.setpoint;
    const tolerance = currentStep.tolerancePercent;
    const toleranceRange = (setpoint * tolerance) / 100;
    const lowerBound = setpoint - toleranceRange;
    const upperBound = setpoint + toleranceRange;
    const withinTolerance = currentWeight >= lowerBound && currentWeight <= upperBound;

    if (!withinTolerance) {
      alert(
        `Weight ${currentWeight.toFixed(3)}g is not within tolerance range ${lowerBound.toFixed(3)}g - ${upperBound.toFixed(3)}g`
      );
      return;
    }

    if (!isStable) {
      alert('Please wait for the weight to stabilize');
      return;
    }

    try {
      setIsLoggingStep(true);

      // Generate QR code
      const qrResponse = await qrApi.generate({
        materialCode: currentStep.material.code,
        materialName: currentStep.material.name,
        setpoint: setpoint,
        actualValue: currentWeight,
        equipment: currentStep.equipment?.name || 'N/A',
      });

      const qrCodeData = qrResponse.data.data.qrCodeData;
      const qrCodeImage = qrResponse.data.data.qrCodeImage;

      // Log the step with the generated QR code
      await batchesApi.logProcessStep(processBatch.activeBatch.id, {
        stepId: currentStep.id,
        materialId: currentStep.materialId,
        actualWeight: currentWeight,
        setpointSnapshot: setpoint,
        toleranceSnapshot: tolerance,
        generatedQrCode: qrCodeData,
      });

      // Update state
      const newProcessedSteps = new Set(processBatch.processedSteps);
      newProcessedSteps.add(currentStep.id);

      const newQRCodes = new Map(processBatch.generatedQRCodes);
      newQRCodes.set(currentStep.id, qrCodeImage);

      setProcessBatch({
        ...processBatch,
        processedSteps: newProcessedSteps,
        generatedQRCodes: newQRCodes,
        currentStepIndex: processBatch.currentStepIndex + 1,
      });

      setIsLoggingStep(false);
      alert('Step processed successfully! QR code generated.');
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to log step');
      setIsLoggingStep(false);
    }
  };

  const handleCompleteProcess = async () => {
    if (!processBatch.activeBatch) return;

    if (processBatch.processedSteps.size !== processBatch.currentRecipe?.steps.length) {
      alert('Please process all steps before completing');
      return;
    }

    if (!confirm('Are you sure you want to complete this process batch?')) {
      return;
    }

    try {
      setIsCompleting(true);
      await batchesApi.completeProcess(processBatch.activeBatch.id);
      alert('Process batch completed successfully!');

      // Reset state
      setProcessBatch({
        activeBatch: null,
        currentRecipe: null,
        currentStepIndex: 0,
        processedSteps: new Set(),
        generatedQRCodes: new Map(),
      });

      setIsCompleting(false);
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to complete process batch');
      setIsCompleting(false);
    }
  };

  const handleDownloadQR = (stepId: number, materialName: string) => {
    const qrImage = processBatch.generatedQRCodes.get(stepId);
    if (!qrImage) return;

    const link = document.createElement('a');
    link.href = qrImage;
    link.download = `${materialName}_QR_${Date.now()}.png`;
    link.click();
  };

  const currentStep = processBatch.currentRecipe?.steps[processBatch.currentStepIndex];
  const allStepsProcessed = processBatch.processedSteps.size === processBatch.currentRecipe?.steps.length;

  // Calculate tolerance values for current step
  let withinTolerance = false;
  let lowerBound = 0;
  let upperBound = 0;
  if (currentStep && currentWeight !== null) {
    const setpoint = currentStep.setpoint;
    const tolerance = currentStep.tolerancePercent;
    const toleranceRange = (setpoint * tolerance) / 100;
    lowerBound = setpoint - toleranceRange;
    upperBound = setpoint + toleranceRange;
    withinTolerance = currentWeight >= lowerBound && currentWeight <= upperBound;
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Process Batch</h1>

      {/* Load Cell Connection Section */}
      <div className="mb-6 bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Load Cell Connection</h2>
        <div className="flex items-center gap-4">
          <button
            onClick={isConnected ? disconnect : connect}
            className={`px-4 py-2 rounded ${
              isConnected ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'
            } text-white`}
          >
            {isConnected ? 'Disconnect' : 'Connect Load Cell'}
          </button>

          {isConnected && (
            <>
              <button onClick={tare} className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">
                Tare
              </button>

              <div className="flex items-center gap-2">
                <span className="font-semibold">Status:</span>
                <span className="px-3 py-1 rounded bg-green-100 text-green-800">Connected</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-semibold">Weight:</span>
                <span className={`px-3 py-1 rounded ${isStable ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'}`}>
                  {currentWeight !== null ? currentWeight.toFixed(3) : '0.000'}g {isStable && '(Stable)'}
                </span>
              </div>
            </>
          )}

          {!isConnected && loadCellError && (
            <div className="text-red-600">Error: {loadCellError}</div>
          )}
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
              onChange={(e) => setSelectedRecipeId(Number(e.target.value))}
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
          {/* Recipe Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-2">{processBatch.currentRecipe.name}</h2>
            <p className="text-gray-600">
              Step {processBatch.currentStepIndex + 1} of {processBatch.currentRecipe.steps.length}
            </p>
            <div className="mt-2">
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-green-500 h-3 rounded-full"
                  style={{
                    width: `${(processBatch.processedSteps.size / processBatch.currentRecipe.steps.length) * 100}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Current Step */}
          {currentStep && !allStepsProcessed && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Current Step</h3>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-600">Material</p>
                  <p className="font-semibold">{currentStep.material.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Target Weight</p>
                  <p className="font-semibold">{currentStep.setpoint.toFixed(3)}g</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Tolerance</p>
                  <p className="font-semibold">±{currentStep.tolerancePercent}%</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Acceptable Range</p>
                  <p className="font-semibold">
                    {lowerBound.toFixed(3)}g - {upperBound.toFixed(3)}g
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <div
                  className={`p-4 rounded text-center text-3xl font-bold ${
                    withinTolerance && isStable
                      ? 'bg-green-100 text-green-800'
                      : withinTolerance
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {currentWeight !== null ? currentWeight.toFixed(3) : '0.000'}g
                  {withinTolerance && isStable && ' ✓ Ready'}
                  {withinTolerance && !isStable && ' (Stabilizing...)'}
                  {!withinTolerance && currentWeight !== null && ' ✗ Out of Range'}
                </div>
              </div>

              <button
                onClick={handleLogStep}
                disabled={!withinTolerance || !isStable || isLoggingStep}
                className="w-full py-3 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 font-semibold"
              >
                {isLoggingStep ? 'Processing & Generating QR...' : 'Process Step & Generate QR Code'}
              </button>
            </div>
          )}

          {/* Processed Steps List */}
          {processBatch.processedSteps.size > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Processed Steps</h3>
              <div className="space-y-3">
                {processBatch.currentRecipe.steps
                  .filter((step: any) => processBatch.processedSteps.has(step.id))
                  .map((step: any) => (
                    <div key={step.id} className="flex items-center justify-between p-3 bg-green-50 rounded">
                      <div>
                        <p className="font-semibold">{step.material.name}</p>
                        <p className="text-sm text-gray-600">
                          Target: {step.setpoint.toFixed(3)}g
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 bg-green-200 text-green-800 rounded text-sm">
                          ✓ Processed
                        </span>
                        {processBatch.generatedQRCodes.has(step.id) && (
                          <button
                            onClick={() => handleDownloadQR(step.id, step.material.name)}
                            className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                          >
                            Download QR
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Complete Button */}
          {allStepsProcessed && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4 text-green-600">
                All steps processed! You can now complete the process batch.
              </h3>
              <button
                onClick={handleCompleteProcess}
                disabled={isCompleting}
                className="w-full py-3 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300 font-semibold"
              >
                {isCompleting ? 'Completing...' : 'Complete Process Batch'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProcessBatch;
