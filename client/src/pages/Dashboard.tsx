import React, { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { dashboardApi } from '../api/dashboard.api';

const Dashboard: React.FC = () => {
  const [overview, setOverview] = useState<any>(null);
  const [trends, setTrends] = useState<any[]>([]);
  const [materialUsage, setMaterialUsage] = useState<any[]>([]);
  const [operators, setOperators] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      const [overviewRes, trendsRes, materialUsageRes, operatorsRes, alertsRes] = await Promise.all(
        [
          dashboardApi.getOverview(),
          dashboardApi.getTrends(30),
          dashboardApi.getMaterialUsage(10),
          dashboardApi.getOperatorPerformance(),
          dashboardApi.getAlerts(10),
        ],
      );

      setOverview(overviewRes.data.data);
      setTrends(trendsRes.data.data);
      setMaterialUsage(materialUsageRes.data.data);
      setOperators(operatorsRes.data.data);
      setAlerts(alertsRes.data.data);
      setLoading(false);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="spinner"></div>
        <span className="ml-3 text-gray-600">Loading dashboard...</span>
      </div>
    );
  }

  // const COLORS = ['#0ea5e9', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Active Batches</p>
              <p className="text-3xl font-bold text-primary-600">{overview?.activeBatches || 0}</p>
            </div>
            <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">⚗️</span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">In progress right now</p>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Today's Batches</p>
              <p className="text-3xl font-bold text-success-600">{overview?.todayBatches || 0}</p>
            </div>
            <div className="w-12 h-12 bg-success-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">📊</span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Completed today</p>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">This Week</p>
              <p className="text-3xl font-bold text-warning-600">{overview?.weekBatches || 0}</p>
            </div>
            <div className="w-12 h-12 bg-warning-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">📅</span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Last 7 days</p>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">This Month</p>
              <p className="text-3xl font-bold text-danger-600">{overview?.monthBatches || 0}</p>
            </div>
            <div className="w-12 h-12 bg-danger-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">📈</span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Last 30 days</p>
        </div>
      </div>

      {/* Batch Trends Chart */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Batch Completion Trends (30 Days)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={trends}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="completed"
              stroke="#22c55e"
              name="Completed"
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="aborted"
              stroke="#ef4444"
              name="Aborted"
              strokeWidth={2}
            />
            <Line type="monotone" dataKey="total" stroke="#0ea5e9" name="Total" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Material Usage */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Top Materials Used</h3>
          <div className="space-y-3 max-h-[300px] overflow-y-auto scrollbar-thin">
            {materialUsage.map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="font-medium">{item.material.name}</p>
                  <p className="text-sm text-gray-500">{item.material.code}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{item.usageCount}x</p>
                  <p className="text-sm text-gray-500">{Number(item.totalWeight).toFixed(2)}g</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Operator Performance */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Operator Performance</h3>
          <div className="space-y-3 max-h-[300px] overflow-y-auto scrollbar-thin">
            {operators.map(op => (
              <div key={op.id} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium">{op.username}</p>
                  <span
                    className={`badge ${Number(op.completionRate) >= 90 ? 'badge-success' : Number(op.completionRate) >= 70 ? 'badge-warning' : 'badge-danger'}`}
                  >
                    {Number(op.completionRate).toFixed(1)}%
                  </span>
                </div>
                <div className="flex gap-4 text-sm text-gray-600">
                  <span>Total: {op.totalBatches}</span>
                  <span className="text-success-600">✓ {op.completed}</span>
                  <span className="text-danger-600">✗ {op.aborted}</span>
                </div>
                {op.currentBatch && (
                  <p className="text-xs text-primary-600 mt-2">
                    Currently: {op.currentBatch.recipe}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Alerts */}
      {alerts.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <span className="text-2xl mr-2">⚠️</span>
            Recent Alerts (Out of Tolerance)
          </h3>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Batch ID</th>
                  <th>Recipe</th>
                  <th>Operator</th>
                  <th>Material</th>
                  <th>Setpoint</th>
                  <th>Actual</th>
                  <th>Deviation</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map(alert => (
                  <tr key={alert.id}>
                    <td className="font-mono">#{alert.batchId}</td>
                    <td>{alert.batchRecipe}</td>
                    <td>{alert.operator}</td>
                    <td>
                      {alert.material}
                      <span className="text-xs text-gray-500 block">{alert.materialCode}</span>
                    </td>
                    <td>{Number(alert.setpoint).toFixed(2)}g</td>
                    <td className="text-danger-600 font-semibold">
                      {Number(alert.actualWeight).toFixed(2)}g
                    </td>
                    <td>
                      <span className="badge-danger">{alert.deviation}%</span>
                    </td>
                    <td className="text-sm text-gray-500">
                      {new Date(alert.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Resource Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card text-center">
          <p className="text-sm text-gray-500 mb-2">Total Recipes</p>
          <p className="text-4xl font-bold text-primary-600">{overview?.totalRecipes || 0}</p>
        </div>
        <div className="card text-center">
          <p className="text-sm text-gray-500 mb-2">Total Materials</p>
          <p className="text-4xl font-bold text-success-600">{overview?.totalMaterials || 0}</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
