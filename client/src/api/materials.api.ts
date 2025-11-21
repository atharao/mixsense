import { get, post, put, del } from './http';
import { Material } from '../types/models';
import { CreateMaterialRequest, UpdateMaterialRequest } from '../types/api';

export const materialsApi = {
  getAll: () => get<Material[]>('/materials'),

  getById: (id: number) => get<Material>(`/materials/${id}`),

  create: (data: CreateMaterialRequest) => post<Material>('/materials', data),

  update: (id: number, data: UpdateMaterialRequest) => put<Material>(`/materials/${id}`, data),

  delete: (id: number) => del(`/materials/${id}`),
};
