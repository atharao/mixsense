// User types
export type UserRole = 'ADMIN' | 'OPERATOR';

export interface User {
  id: number;
  username: string;
  role: UserRole;
  createdAt: string;
}

// Material types
export interface Material {
  id: number;
  name: string;
  code: string;
  createdByUserId: number;
  createdAt: string;
  createdBy?: {
    id: number;
    username: string;
  };
}

// Recipe types
export interface Recipe {
  id: number;
  name: string;
  createdByUserId: number;
  createdAt: string;
  deletedAt?: string | null;
  createdBy?: {
    id: number;
    username: string;
  };
  steps?: RecipeStep[];
}

export interface RecipeStep {
  id: number;
  recipeId: number;
  materialId: number;
  stepOrder: number;
  setpoint: number;
  tolerancePercent: number;
  material?: Material;
}

// Batch types
export type BatchStatus = 'IN_PROGRESS' | 'COMPLETED' | 'ABORTED';

export interface Batch {
  id: number;
  recipeId: number;
  operatorUserId: number;
  startTime: string;
  endTime?: string | null;
  status: BatchStatus;
  recipe?: Recipe;
  operator?: User;
  logs?: BatchLog[];
}

export interface BatchLog {
  id: number;
  batchId: number;
  stepId: number;
  materialId: number;
  actualWeight: number;
  setpointSnapshot: number;
  toleranceSnapshot: number;
  materialCodeSnapshot?: string | null;
  materialNameSnapshot?: string | null;
  recipeNameSnapshot?: string | null;
  stepOrderSnapshot?: number | null;
  processRecipeUserId?: number | null;
  processRecipeTimestamp?: string | null;
  processBatchTimestamp: string;
  qrCodeData?: string | null;
  step?: RecipeStep;
  material?: Material;
  processRecipeUser?: User;
}

// Dashboard types
export interface DashboardData {
  activeBatchCount: number;
  todayBatches: number;
  weekBatches: number;
  monthBatches: number;
  totalRecipes: number;
  totalMaterials: number;
  recentBatches: Batch[];
}

// QR types
export interface QRData {
  materialCode: string;
  setpoint: number;
  actualValue: number;
  materialName: string;
}

export interface ParsedQRData {
  materialCode: string;
  setpoint: string;
  actualValue: string;
  materialName: string;
}
