import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { batchesApi } from '../api/batches.api';

interface BatchSummaryData {
  batchId: number;
  recipeName: string;
  completedSteps: number;
  totalSteps: number;
}

interface BatchDetails {
  id: number;
  recipeId: number;
  status: string;
  startTime: string;
  endTime: string | null;
  recipe: {
    name: string;
  };
  logs: Array<{
    id: number;
    stepId: number;
    materialId: number;
    actualWeight: number;
    setpointSnapshot: number;
    toleranceSnapshot: number;
    generatedQrCode: string;
    createdAt: string;
    material: {
      code: string;
      name: string;
    };
    step: {
      stepNumber: number;
    };
  }>;
}

const BatchSummary: React.FC = () => {
  const navigate = useNavigate();
  const [summaryData, setSummaryData] = useState<BatchSummaryData | null>(null);
  const [batchDetails, setBatchDetails] = useState<BatchDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCompleting, setIsCompleting] = useState(false);

  useEffect(() => {
    // Load summary data from session storage
    const storedData = sessionStorage.getItem('batchSummary');
    if (!storedData) {
      alert('No batch summary data found');
      navigate('/process-batch');
      return;
    }

    const data: BatchSummaryData = JSON.parse(storedData);
    setSummaryData(data);

    // Fetch full batch details
    loadBatchDetails(data.batchId);
  }, []);

  const loadBatchDetails = async (batchId: number) => {
    try {
      setIsLoading(true);
      const response = await batchesApi.getById(batchId);
      if (response.data.data) {
        setBatchDetails(response.data.data as unknown as BatchDetails);
      }
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading batch details:', error);
      setIsLoading(false);
      alert('Failed to load batch details');
    }
  };

  const handleCompleteBatch = async () => {
    if (!summaryData) return;

    if (!confirm('Are you sure you want to mark this batch as completed?')) {
      return;
    }

    try {
      setIsCompleting(true);
      await batchesApi.completeProcess(summaryData.batchId);
      alert('Batch completed successfully!');

      // Clear session storage
      sessionStorage.removeItem('batchSummary');

      // Navigate to dashboard or batches page
      navigate('/dashboard');
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to complete batch');
      setIsCompleting(false);
    }
  };

  const handleStartNewBatch = () => {
    sessionStorage.removeItem('batchSummary');
    navigate('/process-batch');
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center py-12">
          <div className="text-xl">Loading batch summary...</div>
        </div>
      </div>
    );
  }

  if (!summaryData || !batchDetails) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center py-12">
          <div className="text-xl text-red-600">Failed to load batch summary</div>
          <button
            onClick={() => navigate('/process-batch')}
            className="mt-4 px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Back to Process Batch
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Batch Summary</h1>

      {/* Success Banner */}
      <div className="mb-6 bg-green-100 border-2 border-green-500 rounded-lg p-6">
        <div className="flex items-center gap-4">
          <div className="text-5xl">✓</div>
          <div>
            <h2 className="text-2xl font-bold text-green-800">Batch Processing Complete!</h2>
            <p className="text-green-700">
              All {summaryData.totalSteps} steps have been successfully processed
            </p>
          </div>
        </div>
      </div>

      {/* Batch Info */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-xl font-semibold mb-4">Batch Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Batch ID</p>
            <p className="font-semibold text-lg">{batchDetails.id}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Recipe</p>
            <p className="font-semibold text-lg">{batchDetails.recipe.name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Start Time</p>
            <p className="font-semibold">{new Date(batchDetails.startTime).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Status</p>
            <p className="font-semibold text-lg">
              <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded">
                {batchDetails.status}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Steps Summary */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-xl font-semibold mb-4">Processed Steps</h3>
        <div className="space-y-3">
          {batchDetails.logs
            .sort((a, b) => a.step.stepNumber - b.step.stepNumber)
            .map(log => {
              const setpoint = Number(log.setpointSnapshot);
              const tolerance = Number(log.toleranceSnapshot);
              const actualWeight = Number(log.actualWeight);
              const toleranceRange = (setpoint * tolerance) / 100;
              const lowerBound = setpoint - toleranceRange;
              const upperBound = setpoint + toleranceRange;
              const withinTolerance = actualWeight >= lowerBound && actualWeight <= upperBound;

              return (
                <div
                  key={log.id}
                  className={`p-4 rounded-lg border-2 ${
                    withinTolerance
                      ? 'border-green-500 bg-green-50'
                      : 'border-yellow-500 bg-yellow-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-gray-700">
                          Step {log.step.stepNumber}
                        </span>
                        {withinTolerance && (
                          <span className="px-2 py-1 bg-green-200 text-green-800 rounded text-xs">
                            ✓ Within Tolerance
                          </span>
                        )}
                        {!withinTolerance && (
                          <span className="px-2 py-1 bg-yellow-200 text-yellow-800 rounded text-xs">
                            ⚠ Outside Tolerance
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-5 gap-4 mt-2">
                        <div>
                          <p className="text-xs text-gray-600">Material Code</p>
                          <p className="font-semibold">{log.material.code}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Material Name</p>
                          <p className="font-semibold">{log.material.name}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Target Weight</p>
                          <p className="font-semibold">{setpoint.toFixed(2)} KG</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Actual Weight</p>
                          <p
                            className={`font-semibold ${
                              withinTolerance ? 'text-green-600' : 'text-yellow-600'
                            }`}
                          >
                            {actualWeight.toFixed(2)} KG
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Tolerance</p>
                          <p className="font-semibold">±{tolerance}%</p>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-gray-500">
                        Logged at: {new Date(log.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-xl font-semibold mb-4">Actions</h3>
        <div className="flex gap-4">
          <button
            onClick={handleCompleteBatch}
            disabled={isCompleting}
            className="flex-1 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 font-semibold"
          >
            {isCompleting ? 'Completing...' : 'Complete Batch'}
          </button>
          <button
            onClick={handleStartNewBatch}
            className="flex-1 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-semibold"
          >
            Start New Batch
          </button>
          <button
            onClick={() => navigate('/dashboard')}
            className="flex-1 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-semibold"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default BatchSummary;
