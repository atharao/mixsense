import React, { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { startBatch, nextStep, endBatch } from '../store/batchSlice';
import { setRecipes } from '../store/recipesSlice';
import { recipesApi } from '../api/recipes.api';
import { batchesApi } from '../api/batches.api';
import { qrApi } from '../api/qr.api';
import { useLoadCell } from '../hooks/useLoadCell';
import { useQrScanner } from '../hooks/useQrScanner';

const RunBatch: React.FC = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);
  const { activeBatch, currentRecipe, currentStepIndex, loadCellData, isWithinTolerance } =
    useSelector((state: RootState) => state.batch);
  const { recipes } = useSelector((state: RootState) => state.recipes);

  const [selectedRecipeId, setSelectedRecipeId] = useState<number>(0);
  const [isStarting, setIsStarting] = useState(false);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [qrValidationMessage, setQrValidationMessage] = useState<string>('');
  const [isQrValid, setIsQrValid] = useState(false);
  const [validatedQrCode, setValidatedQrCode] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const {
    isConnected,
    error: loadCellError,
    currentWeight,
    isStable,
    connect,
    disconnect,
    tare,
  } = useLoadCell();
  const {
    isScanning,
    error: _qrError,
    lastScannedCode,
    startScanning,
    stopScanning,
    reset: resetQr,
  } = useQrScanner();

  useEffect(() => {
    loadRecipes();
    checkActiveBatch();

    return () => {
      disconnect();
      stopScanning();
    };
  }, []);

  useEffect(() => {
    if (showQrScanner && videoRef.current && canvasRef.current && !isScanning) {
      startScanning(videoRef.current, canvasRef.current);
    } else if (!showQrScanner && isScanning) {
      stopScanning();
    }
  }, [showQrScanner]);

  useEffect(() => {
    if (lastScannedCode && activeBatch && currentRecipe) {
      handleQrCodeScanned(lastScannedCode);
    }
  }, [lastScannedCode]);

  const loadRecipes = async () => {
    try {
      const response = await recipesApi.getAll();
      dispatch(setRecipes(response.data.data || []));
    } catch (error) {
      console.error('Error loading recipes:', error);
    }
  };

  const checkActiveBatch = async () => {
    try {
      const response = await batchesApi.getActive();
      if (response.data.data) {
        const batch = response.data.data;
        if (batch.recipe) {
          dispatch(startBatch({ batch, recipe: batch.recipe }));
        }
      }
    } catch (error) {
      console.error('Error checking active batch:', error);
    }
  };

  const handleStartBatch = async () => {
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
      const response = await batchesApi.start({ recipeId: selectedRecipeId });
      const batch = response.data.data!;

      // Load full recipe details
      const recipeResponse = await recipesApi.getById(selectedRecipeId);
      const recipe = recipeResponse.data.data!;

      dispatch(startBatch({ batch, recipe }));
      setIsStarting(false);
    } catch (error: any) {
      alert(error.message || 'Failed to start batch');
      setIsStarting(false);
    }
  };

  const handleQrCodeScanned = async (code: string) => {
    if (!activeBatch || !currentRecipe || !currentRecipe.steps) return;

    const currentStep = currentRecipe.steps[currentStepIndex];
    if (!currentStep) return;

    try {
      // Validate QR code from processed batch
      const response = await qrApi.validateProcessed({
        qrCode: code,
        expectedStepId: currentStep.id,
      });

      if (response.data.success) {
        setQrValidationMessage('✓ QR Code from processed batch validated successfully');
        setIsQrValid(true);
        setValidatedQrCode(code);
        setShowQrScanner(false);
      } else {
        setQrValidationMessage(`✗ ${response.data.message}`);
        setIsQrValid(false);
        setValidatedQrCode('');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'QR validation failed';
      setQrValidationMessage(`✗ ${errorMessage}`);
      setIsQrValid(false);
      setValidatedQrCode('');
    }
  };

  const handleLogStep = async () => {
    if (!activeBatch || !currentRecipe || !currentRecipe.steps) return;

    const currentStep = currentRecipe.steps[currentStepIndex];
    if (!currentStep) return;

    if (loadCellData.weight === null) {
      alert('No weight data available');
      return;
    }

    if (!isQrValid || !validatedQrCode) {
      alert('Please scan a valid QR code from a processed batch before logging this step');
      return;
    }

    try {
      await batchesApi.logStep(activeBatch.id, {
        stepId: currentStep.id,
        materialId: currentStep.materialId,
        actualWeight: loadCellData.weight,
        setpointSnapshot: currentStep.setpoint,
        toleranceSnapshot: currentStep.tolerancePercent,
        scannedQrCode: validatedQrCode,
      });

      // Move to next step or complete
      if (currentStepIndex < currentRecipe.steps.length - 1) {
        dispatch(nextStep());
        resetQr();
        setQrValidationMessage('');
        setIsQrValid(false);
        setValidatedQrCode('');
        await tare(); // Auto-tare for next step
      } else {
        // All steps done, offer to complete batch
        if (confirm('All steps completed! Do you want to complete this batch?')) {
          await handleCompleteBatch();
        }
      }
    } catch (error: any) {
      alert(error.message || 'Failed to log step');
    }
  };

  const handleCompleteBatch = async () => {
    if (!activeBatch) return;

    try {
      await batchesApi.end(activeBatch.id, { status: 'COMPLETED' });
      dispatch(endBatch());
      disconnect();
      alert('Batch completed successfully!');
    } catch (error: any) {
      alert(error.message || 'Failed to complete batch');
    }
  };

  const handleAbortBatch = async () => {
    if (!activeBatch) return;

    if (!confirm('Are you sure you want to abort this batch?')) return;

    try {
      await batchesApi.end(activeBatch.id, { status: 'ABORTED' });
      dispatch(endBatch());
      disconnect();
      alert('Batch aborted');
    } catch (error: any) {
      alert(error.message || 'Failed to abort batch');
    }
  };

  const currentStep = currentRecipe?.steps?.[currentStepIndex];
  const toleranceRange = currentStep
    ? (currentStep.setpoint * currentStep.tolerancePercent) / 100
    : 0;
  const lowerBound = currentStep ? currentStep.setpoint - toleranceRange : 0;
  const upperBound = currentStep ? currentStep.setpoint + toleranceRange : 0;

  if (!activeBatch) {
    return (
      <div className="space-y-6">
        <div className="card">
          <h2 className="text-2xl font-bold mb-4">Start New Batch</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Recipe</label>
              <select
                className="input"
                value={selectedRecipeId}
                onChange={e => setSelectedRecipeId(parseInt(e.target.value))}
              >
                <option value={0}>Choose a recipe...</option>
                {recipes.map(recipe => (
                  <option key={recipe.id} value={recipe.id}>
                    {recipe.name} ({recipe.steps?.length || 0} steps)
                  </option>
                ))}
              </select>
            </div>

            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">Load Cell Connection</h3>
              {!isConnected ? (
                <div>
                  <p className="text-sm text-gray-600 mb-3">
                    Connect to your load cell via USB/Serial to enable real-time weight monitoring.
                  </p>
                  <button onClick={connect} className="btn-primary">
                    Connect Load Cell
                  </button>
                  {loadCellError && <p className="text-sm text-danger-600 mt-2">{loadCellError}</p>}
                </div>
              ) : (
                <div className="bg-success-50 border border-success-200 rounded-lg p-4">
                  <p className="text-success-700 font-semibold">✓ Load cell connected</p>
                  <p className="text-sm text-success-600 mt-1">
                    Current weight: {currentWeight?.toFixed(2) || '0.00'}g
                    {isStable && <span className="ml-2">(Stable)</span>}
                  </p>
                  <button onClick={tare} className="btn-secondary mt-2 text-sm">
                    Tare/Zero
                  </button>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={handleStartBatch}
                disabled={!selectedRecipeId || !isConnected || isStarting}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isStarting ? 'Starting...' : 'Start Batch'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card bg-primary-600 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{currentRecipe?.name}</h2>
            <p className="text-primary-100">
              Batch #{activeBatch.id} • Operator: {user?.username}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-primary-100">Step Progress</p>
            <p className="text-3xl font-bold">
              {currentStepIndex + 1} / {currentRecipe?.steps?.length || 0}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Current Step */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Current Step</h3>

          {currentStep ? (
            <div className="space-y-4">
              <div className="bg-primary-50 border-2 border-primary-200 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-10 h-10 bg-primary-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                    {currentStep.stepOrder}
                  </span>
                  <div>
                    <h4 className="text-xl font-bold">{currentStep.material?.name}</h4>
                    <p className="text-sm text-gray-600">{currentStep.material?.code}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Target Weight</p>
                    <p className="text-2xl font-bold text-primary-600">{currentStep.setpoint}g</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Tolerance</p>
                    <p className="text-2xl font-bold text-warning-600">
                      ±{currentStep.tolerancePercent}%
                    </p>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-primary-200">
                  <p className="text-xs text-gray-500">Acceptable Range</p>
                  <p className="text-sm font-semibold">
                    {lowerBound.toFixed(2)}g - {upperBound.toFixed(2)}g
                  </p>
                </div>

                {currentStep.equipment && (
                  <div className="mt-3 pt-3 border-t border-primary-200">
                    <p className="text-xs text-gray-500">Equipment</p>
                    <p className="text-sm font-semibold">{currentStep.equipment.name}</p>
                  </div>
                )}
              </div>

              {/* QR Code Section - REQUIRED */}
              <div>
                <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-3 mb-2">
                  <p className="text-sm text-yellow-800 font-semibold">⚠ QR Code Required</p>
                  <p className="text-xs text-yellow-700 mt-1">
                    You must scan a QR code from a processed batch before logging this step.
                  </p>
                </div>

                {!isQrValid ? (
                  <>
                    <button
                      onClick={() => setShowQrScanner(!showQrScanner)}
                      className={`w-full mb-2 ${showQrScanner ? 'btn-danger' : 'btn-primary'}`}
                    >
                      {showQrScanner ? 'Close QR Scanner' : '📱 Scan QR Code (Required)'}
                    </button>

                    {showQrScanner && (
                      <div className="border-2 border-gray-300 rounded-lg overflow-hidden">
                        <video ref={videoRef} className="w-full" autoPlay playsInline muted />
                        <canvas ref={canvasRef} className="hidden" />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-green-50 border-2 border-green-200 rounded-lg p-3 mb-2">
                    <p className="text-sm text-green-800 font-semibold">✓ QR Code Validated</p>
                    <p className="text-xs text-green-700 mt-1">
                      Valid QR code from processed batch detected.
                    </p>
                  </div>
                )}

                {qrValidationMessage && (
                  <p
                    className={`text-sm mt-2 font-semibold ${qrValidationMessage.startsWith('✓') ? 'text-success-600' : 'text-danger-600'}`}
                  >
                    {qrValidationMessage}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-gray-500">No current step</p>
          )}
        </div>

        {/* Load Cell Reading */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Load Cell Reading</h3>

          <div className="text-center py-8">
            <p
              className="text-6xl font-bold mb-4"
              style={{
                color: isWithinTolerance
                  ? '#22c55e'
                  : currentWeight && currentWeight > 0
                    ? '#ef4444'
                    : '#6b7280',
              }}
            >
              {currentWeight?.toFixed(2) || '0.00'}
              <span className="text-3xl text-gray-400 ml-2">g</span>
            </p>

            <div className="flex items-center justify-center gap-4 mb-6">
              {isStable ? (
                <span className="badge-success">✓ Stable</span>
              ) : (
                <span className="badge-warning">Stabilizing...</span>
              )}

              {currentWeight !== null &&
                currentStep &&
                (isWithinTolerance ? (
                  <span className="badge-success">✓ Within Tolerance</span>
                ) : (
                  <span className="badge-danger">Out of Tolerance</span>
                ))}
            </div>

            <div className="max-w-md mx-auto mb-6">
              <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${isWithinTolerance ? 'bg-success-600' : 'bg-danger-600'}`}
                  style={{
                    width:
                      currentStep && currentWeight
                        ? `${Math.min((currentWeight / currentStep.setpoint) * 100, 100)}%`
                        : '0%',
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0g</span>
                <span>{currentStep?.setpoint}g</span>
              </div>
            </div>

            <div className="flex gap-3 justify-center">
              <button onClick={tare} className="btn-secondary">
                Tare/Zero
              </button>
              <button
                onClick={handleLogStep}
                disabled={!isStable || currentWeight === null || !isQrValid}
                className="btn-success disabled:opacity-50 disabled:cursor-not-allowed"
                title={!isQrValid ? 'Scan a valid QR code first' : ''}
              >
                ✓ Log Step
              </button>
            </div>
            {!isQrValid && (
              <p className="text-xs text-center text-red-600 mt-2">
                QR code validation required before logging
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Batch Actions */}
      <div className="card">
        <div className="flex gap-3 justify-end">
          <button onClick={handleAbortBatch} className="btn-danger">
            ✗ Abort Batch
          </button>
          {currentStepIndex === (currentRecipe?.steps?.length || 0) - 1 && (
            <button onClick={handleCompleteBatch} className="btn-success">
              ✓ Complete Batch
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default RunBatch;
