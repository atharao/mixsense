// User types
export type UserRole = 'ADMIN' | 'OPERATOR';

export interface User {
  id: number;
  username: string;
  role: UserRole;
  createdAt: string;
}

// Material types
export type MaterialType = 'INGREDIENT' | 'EQUIPMENT';

export interface Material {
  id: number;
  name: string;
  code: string;
  type: MaterialType;
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
  equipmentId?: number | null;
  stepOrder: number;
  setpoint: number;
  tolerancePercent: number;
  qrCode?: string | null;
  material?: Material;
  equipment?: Material;
}

// Batch types
export type BatchStatus = 'IN_PROGRESS' | 'COMPLETED' | 'ABORTED';

export interface Batch {
  id: number;
  recipeId: number;
  operatorUserId: number;
  equipmentId?: number | null;
  startTime: string;
  endTime?: string | null;
  status: BatchStatus;
  recipe?: Recipe;
  operator?: User;
  equipment?: Material;
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
  scannedQrCode?: string | null;
  timestamp: string;
  step?: RecipeStep;
  material?: Material;
}

// Dashboard types
export interface EquipmentStatus {
  equipmentId: number;
  equipmentName: string;
  status: 'IDLE' | 'IN_USE';
  batchId?: number | null;
}

export interface DashboardData {
  activeBatchCount: number;
  equipmentStatus: EquipmentStatus[];
}

// QR types
export interface QRData {
  materialCode: string;
  setpoint: number;
  actualValue: number;
  materialName: string;
  equipment: string;
}

export interface ParsedQRData {
  materialCode: string;
  setpoint: string;
  actualValue: string;
  materialName: string;
  equipment: string;
}
