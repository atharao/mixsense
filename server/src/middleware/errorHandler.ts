import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { Prisma } from '@prisma/client';

interface ErrorResponse {
  success: false;
  message: string;
  error?: string;
  details?: any;
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  logger.error('Error caught by error handler:', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Prisma errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    handlePrismaError(err, res);
    return;
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    res.status(400).json({
      success: false,
      message: 'Validation error',
      error: 'Invalid data provided',
    } as ErrorResponse);
    return;
  }

  // Default error response
  const statusCode = (err as any).statusCode || 500;
  const response: ErrorResponse = {
    success: false,
    message: err.message || 'Internal server error',
  };

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.error = err.stack;
  }

  res.status(statusCode).json(response);
};

const handlePrismaError = (err: Prisma.PrismaClientKnownRequestError, res: Response): void => {
  switch (err.code) {
    case 'P2002':
      // Unique constraint violation
      res.status(409).json({
        success: false,
        message: 'A record with this value already exists',
        details: err.meta,
      } as ErrorResponse);
      break;

    case 'P2025':
      // Record not found
      res.status(404).json({
        success: false,
        message: 'Record not found',
      } as ErrorResponse);
      break;

    case 'P2003':
      // Foreign key constraint violation
      res.status(400).json({
        success: false,
        message: 'Invalid reference. Related record does not exist.',
        details: err.meta,
      } as ErrorResponse);
      break;

    case 'P2014':
      // Invalid ID
      res.status(400).json({
        success: false,
        message: 'Invalid ID provided',
      } as ErrorResponse);
      break;

    default:
      res.status(500).json({
        success: false,
        message: 'Database error occurred',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined,
      } as ErrorResponse);
  }
};

// 404 handler
export const notFoundHandler = (req: Request, res: Response, _next: NextFunction): void => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
  } as ErrorResponse);
};
