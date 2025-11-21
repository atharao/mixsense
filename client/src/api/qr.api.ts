import { get, post } from './http';
import { GenerateQRRequest, ValidateQRRequest } from '../types/api';

export const qrApi = {
  generate: (data: GenerateQRRequest) => post('/qr/generate', data),

  validate: (data: ValidateQRRequest) => post('/qr/validate', data),

  getBatchLogQR: (batchLogId: number) => get(`/qr/batch-log/${batchLogId}`),

  getRecipeQRCodes: (recipeId: number) => get(`/qr/recipe/${recipeId}`),
};
