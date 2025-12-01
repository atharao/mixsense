import { Router } from 'express';
import { DashboardController } from './dashboard.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();
const dashboardController = new DashboardController();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/dashboard/overview
 * Get dashboard overview statistics
 */
router.get('/overview', dashboardController.getOverview.bind(dashboardController));

/**
 * GET /api/dashboard/trends
 * Get batch completion trends
 */
router.get('/trends', dashboardController.getTrends.bind(dashboardController));

/**
 * GET /api/dashboard/material-usage
 * Get material usage statistics
 */
router.get('/material-usage', dashboardController.getMaterialUsage.bind(dashboardController));

/**
 * GET /api/dashboard/operators
 * Get operator performance
 */
router.get('/operators', dashboardController.getOperatorPerformance.bind(dashboardController));

/**
 * GET /api/dashboard/alerts
 * Get recent alerts
 */
router.get('/alerts', dashboardController.getAlerts.bind(dashboardController));

export default router;
