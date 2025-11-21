import { get, post, put } from './http';
import { Batch, BatchLog } from '../types/models';
import { StartBatchRequest, LogStepRequest, EndBatchRequest } from '../types/api';

export const batchesApi = {
  getAll: (params?: any) => get<Batch[]>('/batches', { params }),

  getById: (id: number) => get<Batch>(`/batches/${id}`),

  getActive: () => get<Batch | null>('/batches/active'),

  start: (data: StartBatchRequest) => post<Batch>('/batches/start', data),

  logStep: (batchId: number, data: LogStepRequest) =>
    post<BatchLog>(`/batches/${batchId}/log-step`, data),

  end: (batchId: number, data: EndBatchRequest) => put<Batch>(`/batches/${batchId}/end`, data),

  getStatistics: (params?: any) => get('/batches/statistics', { params }),
};
