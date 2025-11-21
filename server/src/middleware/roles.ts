import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export const requireRole = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
        return;
      }

      const userRole = req.user.role;

      if (!allowedRoles.includes(userRole)) {
        logger.warn(`Access denied for user ${req.user.username} with role ${userRole}`);
        res.status(403).json({
          success: false,
          message: 'Access denied. Insufficient permissions.',
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Role middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });
    }
  };
};

// Convenience middleware for admin-only routes
export const requireAdmin = requireRole('ADMIN');

// Convenience middleware for operator-only routes
export const requireOperator = requireRole('OPERATOR');

// Middleware for routes accessible by both roles
export const requireAuthenticated = requireRole('ADMIN', 'OPERATOR');
