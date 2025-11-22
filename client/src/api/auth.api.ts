import { post, get, put, del } from './http';
import { User } from '../types/models';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface CreateUserRequest {
  username: string;
  password: string;
  role: 'ADMIN' | 'OPERATOR';
}

export interface UpdateUserRequest {
  username?: string;
  role?: 'ADMIN' | 'OPERATOR';
  password?: string;
}

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

export const authApi = {
  login: (credentials: LoginRequest) => post<LoginResponse>('/auth/login', credentials),
  getCurrentUser: () => get<User>('/auth/me'),
  getAllUsers: () => get<User[]>('/auth/users'),
  createUser: (data: CreateUserRequest) => post<User>('/auth/users', data),
  updateUser: (id: number, data: UpdateUserRequest) => put<User>(`/auth/users/${id}`, data),
  deleteUser: (id: number) => del(`/auth/users/${id}`),
  changePassword: (data: ChangePasswordRequest) => post<void>('/auth/change-password', data),
};
