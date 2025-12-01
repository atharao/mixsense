import http, { get } from './http';
import { ReportFilters } from '../types/api';

/**
 * Helper function to trigger file download from blob
 */
const downloadBlob = (blob: Blob, filename: string) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

export const reportsApi = {
  getBatchReports: (filters?: ReportFilters) => get('/reports', { params: filters }),

  downloadPdf: async (batchId: number) => {
    try {
      const response = await http.get(`/reports/pdf/${batchId}`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      downloadBlob(blob, `batch_${batchId}_report.pdf`);
    } catch (error: any) {
      console.error('Error downloading PDF:', error);
      alert(error.message || 'Failed to download PDF report');
    }
  },

  downloadExcel: async (filters?: ReportFilters) => {
    try {
      const response = await http.get('/reports/excel', {
        params: filters,
        responseType: 'blob',
      });
      const timestamp = new Date().toISOString().split('T')[0];
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      downloadBlob(blob, `batch_reports_${timestamp}.xlsx`);
    } catch (error: any) {
      console.error('Error downloading Excel:', error);
      alert(error.message || 'Failed to download Excel report');
    }
  },

  getStatistics: (filters?: ReportFilters) => get('/reports/statistics', { params: filters }),
};
