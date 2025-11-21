import { get, post, put, del } from './http';
import { Recipe } from '../types/models';
import { CreateRecipeRequest, UpdateRecipeRequest } from '../types/api';

export const recipesApi = {
  getAll: () => get<Recipe[]>('/recipes'),

  getById: (id: number) => get<Recipe>(`/recipes/${id}`),

  create: (data: CreateRecipeRequest) => post<Recipe>('/recipes', data),

  update: (id: number, data: UpdateRecipeRequest) => put<Recipe>(`/recipes/${id}`, data),

  delete: (id: number) => del(`/recipes/${id}`),
};
