import React, { useEffect, useState } from 'react';
import { reportsApi } from '../api/reports.api';
import { recipesApi } from '../api/recipes.api';
import { Batch, Recipe, BatchLog } from '../types/models';

// Helper function to calculate if a log is within tolerance
const isWithinTolerance = (log: BatchLog): boolean => {
  const actualWeight = Number(log.actualWeight);
  const setpoint = Number(log.setpointSnapshot);
  const tolerance = Number(log.toleranceSnapshot);

  const toleranceRange = (setpoint * tolerance) / 100;
  const lowerBound = setpoint - toleranceRange;
  const upperBound = setpoint + toleranceRange;

  return actualWeight >= lowerBound && actualWeight <= upperBound;
};

const Reports: React.FC = () => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState({
    batchId: '',
    recipeId: '',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [batchesRes, recipesRes] = await Promise.all([
        reportsApi.getBatchReports(),
        recipesApi.getAll(),
      ]);
      setBatches(batchesRes.data.data || []);
      setRecipes(recipesRes.data.data || []);
      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    }
  };

  const handleApplyFilters = async () => {
    try {
      setLoading(true);
      const filterParams: any = {};

      if (filters.batchId) filterParams.batchId = parseInt(filters.batchId);
      if (filters.recipeId) filterParams.recipeId = parseInt(filters.recipeId);
      if (filters.startDate) filterParams.startDate = filters.startDate;
      if (filters.endDate) filterParams.endDate = filters.endDate;

      const response = await reportsApi.getBatchReports(filterParams);
      setBatches(response.data.data || []);
      setLoading(false);
    } catch (error) {
      console.error('Error applying filters:', error);
      setLoading(false);
    }
  };

  const handleClearFilters = () => {
    setFilters({
      batchId: '',
      recipeId: '',
      startDate: '',
      endDate: '',
    });
    loadData();
  };

  const handleExportPDF = (batchId: number) => {
    reportsApi.downloadPdf(batchId);
  };

  const handleExportAllExcel = () => {
    const filterParams: any = {};
    if (filters.batchId) filterParams.batchId = parseInt(filters.batchId);
    if (filters.recipeId) filterParams.recipeId = parseInt(filters.recipeId);
    if (filters.startDate) filterParams.startDate = filters.startDate;
    if (filters.endDate) filterParams.endDate = filters.endDate;

    reportsApi.downloadExcel(filterParams);
  };

  const handleViewDetails = (batch: Batch) => {
    setSelectedBatch(batch);
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'badge-success';
      case 'ABORTED':
        return 'badge-danger';
      case 'IN_PROGRESS':
        return 'badge-warning';
      default:
        return 'badge-info';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Batch Reports</h2>
          <p className="text-gray-500">View and export batch history</p>
        </div>
        <button onClick={handleExportAllExcel} className="btn-success">
          📊 Export All to Excel
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <h3 className="font-semibold mb-4">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Batch ID</label>
            <input
              type="number"
              className="input"
              placeholder="e.g., 123"
              value={filters.batchId}
              onChange={e => setFilters({ ...filters, batchId: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Recipe</label>
            <select
              className="input"
              value={filters.recipeId}
              onChange={e => setFilters({ ...filters, recipeId: e.target.value })}
            >
              <option value="">All recipes</option>
              {recipes.map(recipe => (
                <option key={recipe.id} value={recipe.id}>
                  {recipe.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Start Date</label>
            <input
              type="date"
              className="input"
              value={filters.startDate}
              onChange={e => setFilters({ ...filters, startDate: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">End Date</label>
            <input
              type="date"
              className="input"
              value={filters.endDate}
              onChange={e => setFilters({ ...filters, endDate: e.target.value })}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-4">
          <button onClick={handleApplyFilters} className="btn-primary">
            Apply Filters
          </button>
          <button onClick={handleClearFilters} className="btn-secondary">
            Clear Filters
          </button>
        </div>
      </div>

      {/* Batches Table */}
      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="spinner"></div>
            <span className="ml-3 text-gray-600">Loading reports...</span>
          </div>
        ) : batches.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No batches found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Batch ID</th>
                  <th>Recipe</th>
                  <th>Operator</th>
                  <th>Status</th>
                  <th>Started</th>
                  <th>Completed</th>
                  <th>Steps</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {batches.map(batch => (
                  <tr key={batch.id}>
                    <td className="font-mono font-semibold">#{batch.id}</td>
                    <td>{batch.recipe?.name}</td>
                    <td>{batch.operator?.username}</td>
                    <td>
                      <span className={getStatusBadgeClass(batch.status)}>{batch.status}</span>
                    </td>
                    <td className="text-sm text-gray-500">
                      {new Date(batch.startTime).toLocaleString()}
                    </td>
                    <td className="text-sm text-gray-500">
                      {batch.endTime ? new Date(batch.endTime).toLocaleString() : '-'}
                    </td>
                    <td className="text-center">{batch.logs?.length || 0}</td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleViewDetails(batch)}
                          className="px-3 py-1 text-sm bg-primary-100 text-primary-700 rounded hover:bg-primary-200"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleExportPDF(batch.id)}
                          className="px-3 py-1 text-sm bg-success-100 text-success-700 rounded hover:bg-success-200"
                        >
                          PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Batch Details Modal */}
      {selectedBatch && (
        <div className="modal-overlay" onClick={() => setSelectedBatch(null)}>
          <div className="modal-content max-w-5xl" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold">Batch #{selectedBatch.id}</h3>
                  <p className="text-gray-500">{selectedBatch.recipe?.name}</p>
                </div>
                <span className={`${getStatusBadgeClass(selectedBatch.status)} text-lg`}>
                  {selectedBatch.status}
                </span>
              </div>

              {/* Batch Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-500">Operator</p>
                  <p className="font-semibold">{selectedBatch.operator?.username}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Started</p>
                  <p className="font-semibold text-sm">
                    {new Date(selectedBatch.startTime).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Completed</p>
                  <p className="font-semibold text-sm">
                    {selectedBatch.endTime ? new Date(selectedBatch.endTime).toLocaleString() : '-'}
                  </p>
                </div>
              </div>

              {/* Batch Logs */}
              <div>
                <h4 className="font-semibold mb-3">Batch Steps</h4>
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Step</th>
                        <th>Material</th>
                        <th>Code</th>
                        <th>Setpoint</th>
                        <th>Actual</th>
                        <th>Tolerance</th>
                        <th>In Range</th>
                        <th>QR Code</th>
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedBatch.logs?.map(log => (
                        <tr key={log.id}>
                          <td className="font-semibold">{log.step?.stepOrder}</td>
                          <td>{log.material?.name}</td>
                          <td className="font-mono text-sm">{log.material?.code}</td>
                          <td>{Number(log.setpointSnapshot).toFixed(2)}g</td>
                          <td
                            className={
                              isWithinTolerance(log)
                                ? 'text-success-600 font-semibold'
                                : 'text-danger-600 font-semibold'
                            }
                          >
                            {Number(log.actualWeight).toFixed(2)}g
                          </td>
                          <td>±{log.toleranceSnapshot}%</td>
                          <td>
                            {isWithinTolerance(log) ? (
                              <span className="badge-success">✓ Yes</span>
                            ) : (
                              <span className="badge-danger">✗ No</span>
                            )}
                          </td>
                          <td className="text-xs font-mono">{log.scannedQrCode || '-'}</td>
                          <td className="text-sm text-gray-500">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Summary */}
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h4 className="font-semibold mb-2">Summary</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Total Steps</p>
                    <p className="text-2xl font-bold">{selectedBatch.logs?.length || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">In Tolerance</p>
                    <p className="text-2xl font-bold text-success-600">
                      {selectedBatch.logs?.filter(l => isWithinTolerance(l)).length || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Tolerance Rate</p>
                    <p className="text-2xl font-bold text-primary-600">
                      {selectedBatch.logs && selectedBatch.logs.length > 0
                        ? (
                            (selectedBatch.logs.filter(l => isWithinTolerance(l)).length /
                              selectedBatch.logs.length) *
                            100
                          ).toFixed(1)
                        : '0'}
                      %
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setSelectedBatch(null)} className="btn-secondary">
                  Close
                </button>
                <button onClick={() => handleExportPDF(selectedBatch.id)} className="btn-success">
                  📄 Export PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
