import { Request, Response } from 'express';
import { ReportsService } from './reports.service';
import { logger } from '../../utils/logger';

const reportsService = new ReportsService();

export class ReportsController {
  /**
   * GET /api/reports
   * Get batch reports with filters
   */
  async getBatchReports(req: Request, res: Response) {
    try {
      const { batchId, recipeId, operatorId, startDate, endDate } = req.query;

      const filters: any = {};

      if (batchId) {
        filters.batchId = parseInt(batchId as string, 10);
      }

      if (recipeId) {
        filters.recipeId = parseInt(recipeId as string, 10);
      }

      if (operatorId) {
        filters.operatorId = parseInt(operatorId as string, 10);
      }

      if (startDate) {
        filters.startDate = new Date(startDate as string);
      }

      if (endDate) {
        filters.endDate = new Date(endDate as string);
      }

      const reports = await reportsService.getBatchReports(filters);

      return res.json({
        success: true,
        data: reports,
      });
    } catch (error: any) {
      logger.error('Error fetching reports:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch reports',
        error: error.message,
      });
    }
  }

  /**
   * GET /api/reports/pdf/:batchId
   * Generate PDF report for a batch
   */
  async generatePdfReport(req: Request, res: Response) {
    try {
      const batchId = parseInt(req.params.batchId, 10);

      if (isNaN(batchId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid batch ID',
        });
      }

      const pdfBuffer = await reportsService.generatePdfReport(batchId);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=batch_${batchId}_report.pdf`);
      res.send(pdfBuffer);
    } catch (error: any) {
      logger.error(`Error generating PDF report for batch ${req.params.batchId}:`, error);

      if (error.message === 'Batch not found') {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to generate PDF report',
        error: error.message,
      });
    }
  }

  /**
   * GET /api/reports/excel
   * Generate Excel report for multiple batches
   */
  async generateExcelReport(req: Request, res: Response) {
    try {
      const { batchId, recipeId, operatorId, startDate, endDate } = req.query;

      const filters: any = {};

      if (batchId) {
        filters.batchId = parseInt(batchId as string, 10);
      }

      if (recipeId) {
        filters.recipeId = parseInt(recipeId as string, 10);
      }

      if (operatorId) {
        filters.operatorId = parseInt(operatorId as string, 10);
      }

      if (startDate) {
        filters.startDate = new Date(startDate as string);
      }

      if (endDate) {
        filters.endDate = new Date(endDate as string);
      }

      const excelBuffer = await reportsService.generateExcelReport(filters);

      const timestamp = new Date().toISOString().split('T')[0];
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=batch_reports_${timestamp}.xlsx`);
      res.send(excelBuffer);
    } catch (error: any) {
      logger.error('Error generating Excel report:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to generate Excel report',
        error: error.message,
      });
    }
  }

  /**
   * GET /api/reports/statistics
   * Get aggregated statistics
   */
  async getStatistics(req: Request, res: Response) {
    try {
      const { recipeId, operatorId, startDate, endDate } = req.query;

      const filters: any = {};

      if (recipeId) {
        filters.recipeId = parseInt(recipeId as string, 10);
      }

      if (operatorId) {
        filters.operatorId = parseInt(operatorId as string, 10);
      }

      if (startDate) {
        filters.startDate = new Date(startDate as string);
      }

      if (endDate) {
        filters.endDate = new Date(endDate as string);
      }

      const statistics = await reportsService.getAggregatedStatistics(filters);

      return res.json({
        success: true,
        data: statistics,
      });
    } catch (error: any) {
      logger.error('Error fetching statistics:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch statistics',
        error: error.message,
      });
    }
  }
}
