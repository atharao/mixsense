// Generic API response types
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  errors?: Array<{
    field?: string;
    message: string;
  }>;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  count?: number;
  page?: number;
  totalPages?: number;
  total?: number;
}

// Auth API types
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: {
    id: number;
    username: string;
    role: string;
  };
}

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

// Material API types
export interface CreateMaterialRequest {
  name: string;
  code: string;
}

export interface UpdateMaterialRequest {
  name?: string;
  code?: string;
}

// Recipe API types
export interface CreateRecipeRequest {
  name: string;
  steps: Array<{
    materialId: number;
    stepOrder: number;
    setpoint: number;
    tolerancePercent: number;
  }>;
}

export interface UpdateRecipeRequest {
  name?: string;
  steps?: Array<{
    id?: number;
    materialId: number;
    stepOrder: number;
    setpoint: number;
    tolerancePercent: number;
  }>;
}

// Batch API types
export interface StartBatchRequest {
  recipeId: number;
}

export interface LogStepRequest {
  stepId: number;
  materialId: number;
  actualWeight: number;
  setpointSnapshot: number;
  toleranceSnapshot: number;
  qrCodeData?: string;
}

export interface EndBatchRequest {
  status: 'COMPLETED' | 'ABORTED';
}

// Report API types
export interface ReportFilters {
  batchId?: number;
  startDate?: string;
  endDate?: string;
  recipeId?: number;
  operatorId?: number;
}

// QR API types
export interface GenerateQRRequest {
  materialCode: string;
  setpoint: number;
  actualValue: number;
  materialName: string;
}

export interface ValidateQRRequest {
  qrCode: string;
  expectedMaterialId: number;
  stepId: number;
}
