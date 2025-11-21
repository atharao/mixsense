import { Router } from 'express';
import { ReportsController } from './reports.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/roles';

const router = Router();
const reportsController = new ReportsController();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/reports/statistics
 * Get aggregated statistics (admin only)
 */
router.get('/statistics', requireRole('ADMIN'), reportsController.getStatistics.bind(reportsController));

/**
 * GET /api/reports/excel
 * Generate Excel report for multiple batches
 */
router.get('/excel', reportsController.generateExcelReport.bind(reportsController));

/**
 * GET /api/reports/pdf/:batchId
 * Generate PDF report for a batch
 */
router.get('/pdf/:batchId', reportsController.generatePdfReport.bind(reportsController));

/**
 * GET /api/reports
 * Get batch reports with filters
 */
router.get('/', reportsController.getBatchReports.bind(reportsController));

export default router;
