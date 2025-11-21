import { get } from './http';
import { ReportFilters } from '../types/api';

export const reportsApi = {
  getBatchReports: (filters?: ReportFilters) => get('/reports', { params: filters }),

  downloadPdf: (batchId: number) => {
    const url = `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/reports/pdf/${batchId}`;
    window.open(url, '_blank');
  },

  downloadExcel: (filters?: ReportFilters) => {
    const params = new URLSearchParams(filters as any).toString();
    const url = `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/reports/excel${params ? `?${params}` : ''}`;
    window.open(url, '_blank');
  },

  getStatistics: (filters?: ReportFilters) => get('/reports/statistics', { params: filters }),
};
