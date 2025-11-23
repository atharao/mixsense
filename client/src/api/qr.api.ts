import { get, post } from './http';
import { GenerateQRRequest, ValidateQRRequest } from '../types/api';

export const qrApi = {
  generate: (data: GenerateQRRequest) => post('/qr/generate', data),

  validate: (data: ValidateQRRequest) => post('/qr/validate', data),

  validateProcessed: (data: { qrCode: string; expectedStepId: number }) =>
    post('/qr/validate-processed', data),

  getBatchLogQR: (batchLogId: number) => get(`/qr/batch-log/${batchLogId}`),

  getRecipeQRCodes: (recipeId: number) => get(`/qr/recipe/${recipeId}`),
};
