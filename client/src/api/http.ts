import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { ApiResponse } from '../types/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Create axios instance
const http: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Add auth token to requests
http.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  },
);

// Response interceptor - Handle errors globally
http.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error: AxiosError<ApiResponse>) => {
    // Handle different error scenarios
    if (error.response) {
      const { status, data } = error.response;

      // Unauthorized - Clear token and redirect to login
      if (status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }

      // Forbidden
      if (status === 403) {
        console.error('Access denied:', data.message);
      }

      // Server error
      if (status >= 500) {
        console.error('Server error:', data.message);
      }

      return Promise.reject({
        status,
        message: data.message || 'An error occurred',
        errors: data.errors,
      });
    } else if (error.request) {
      // Network error
      console.error('Network error:', error.message);
      return Promise.reject({
        status: 0,
        message: 'Network error. Please check your connection.',
      });
    } else {
      // Other errors
      console.error('Error:', error.message);
      return Promise.reject({
        status: 0,
        message: error.message || 'An unexpected error occurred',
      });
    }
  },
);

// Helper functions for common HTTP methods
export const get = <T = any>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<AxiosResponse<ApiResponse<T>>> => {
  return http.get(url, config);
};

export const post = <T = any>(
  url: string,
  data?: any,
  config?: AxiosRequestConfig,
): Promise<AxiosResponse<ApiResponse<T>>> => {
  return http.post(url, data, config);
};

export const put = <T = any>(
  url: string,
  data?: any,
  config?: AxiosRequestConfig,
): Promise<AxiosResponse<ApiResponse<T>>> => {
  return http.put(url, data, config);
};

export const del = <T = any>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<AxiosResponse<ApiResponse<T>>> => {
  return http.delete(url, config);
};

export const patch = <T = any>(
  url: string,
  data?: any,
  config?: AxiosRequestConfig,
): Promise<AxiosResponse<ApiResponse<T>>> => {
  return http.patch(url, data, config);
};

export default http;
