import { Request, Response } from 'express';
import { DashboardService } from './dashboard.service';
import { logger } from '../../utils/logger';

const dashboardService = new DashboardService();

export class DashboardController {
  /**
   * GET /api/dashboard/overview
   * Get dashboard overview statistics
   */
  async getOverview(_req: Request, res: Response) {
    try {
      const overview = await dashboardService.getDashboardOverview();

      return res.json({
        success: true,
        data: overview,
      });
    } catch (error: any) {
      logger.error('Error fetching dashboard overview:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch dashboard overview',
        error: error.message,
      });
    }
  }

  /**
   * GET /api/dashboard/trends
   * Get batch completion trends
   */
  async getTrends(req: Request, res: Response) {
    try {
      const days = req.query.days ? parseInt(req.query.days as string, 10) : 30;

      if (isNaN(days) || days < 1 || days > 365) {
        return res.status(400).json({
          success: false,
          message: 'Days must be between 1 and 365',
        });
      }

      const trends = await dashboardService.getBatchTrends(days);

      return res.json({
        success: true,
        data: trends,
      });
    } catch (error: any) {
      logger.error('Error fetching batch trends:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch batch trends',
        error: error.message,
      });
    }
  }

  /**
   * GET /api/dashboard/material-usage
   * Get material usage statistics
   */
  async getMaterialUsage(req: Request, res: Response) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

      if (isNaN(limit) || limit < 1 || limit > 100) {
        return res.status(400).json({
          success: false,
          message: 'Limit must be between 1 and 100',
        });
      }

      const materialUsage = await dashboardService.getMaterialUsage(limit);

      return res.json({
        success: true,
        data: materialUsage,
      });
    } catch (error: any) {
      logger.error('Error fetching material usage:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch material usage',
        error: error.message,
      });
    }
  }

  /**
   * GET /api/dashboard/operators
   * Get operator performance
   */
  async getOperatorPerformance(_req: Request, res: Response) {
    try {
      const operatorPerformance = await dashboardService.getOperatorPerformance();

      return res.json({
        success: true,
        data: operatorPerformance,
      });
    } catch (error: any) {
      logger.error('Error fetching operator performance:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch operator performance',
        error: error.message,
      });
    }
  }

  /**
   * GET /api/dashboard/alerts
   * Get recent alerts
   */
  async getAlerts(req: Request, res: Response) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

      if (isNaN(limit) || limit < 1 || limit > 100) {
        return res.status(400).json({
          success: false,
          message: 'Limit must be between 1 and 100',
        });
      }

      const alerts = await dashboardService.getRecentAlerts(limit);

      return res.json({
        success: true,
        data: alerts,
      });
    } catch (error: any) {
      logger.error('Error fetching alerts:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch alerts',
        error: error.message,
      });
    }
  }
}
