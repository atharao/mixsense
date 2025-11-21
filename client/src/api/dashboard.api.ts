import { get } from './http';

export const dashboardApi = {
  getOverview: () => get('/dashboard/overview'),
  getEquipmentStatus: () => get('/dashboard/equipment'),
  getTrends: (days: number = 30) => get('/dashboard/trends', { params: { days } }),
  getMaterialUsage: (limit: number = 10) => get('/dashboard/material-usage', { params: { limit } }),
  getOperatorPerformance: () => get('/dashboard/operators'),
  getAlerts: (limit: number = 10) => get('/dashboard/alerts', { params: { limit } }),
};
