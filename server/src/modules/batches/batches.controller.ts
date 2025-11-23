import { Request, Response } from 'express';
import { BatchesService } from './batches.service';
import { logger } from '../../utils/logger';

const batchesService = new BatchesService();

export class BatchesController {
  /**
   * GET /api/batches
   * Get all batches with optional filters
   */
  async getAllBatches(req: Request, res: Response) {
    try {
      const { recipeId, operatorId, startDate, endDate, status } = req.query;

      const filters: any = {};

      if (recipeId) {
        filters.recipeId = parseInt(recipeId as string, 10);
      }

      if (operatorId) {
        filters.operatorId = parseInt(operatorId as string, 10);
      }

      if (status) {
        filters.status = status as string;
      }

      if (startDate) {
        filters.startDate = new Date(startDate as string);
      }

      if (endDate) {
        filters.endDate = new Date(endDate as string);
      }

      const batches = await batchesService.getAllBatches(filters);

      return res.json({
        success: true,
        data: batches,
      });
    } catch (error: any) {
      logger.error('Error fetching batches:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch batches',
        error: error.message,
      });
    }
  }

  /**
   * GET /api/batches/:id
   * Get a single batch by ID
   */
  async getBatchById(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);

      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid batch ID',
        });
      }

      const batch = await batchesService.getBatchById(id);

      return res.json({
        success: true,
        data: batch,
      });
    } catch (error: any) {
      logger.error(`Error fetching batch ${req.params.id}:`, error);

      if (error.message === 'Batch not found') {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to fetch batch',
        error: error.message,
      });
    }
  }

  /**
   * POST /api/batches/start
   * Start a new batch
   */
  async startBatch(req: Request, res: Response) {
    try {
      const { recipeId, equipmentId } = req.body;
      const operatorId = req.user!.userId; // From auth middleware

      // Validation
      if (!recipeId) {
        return res.status(400).json({
          success: false,
          message: 'Recipe ID is required',
        });
      }

      // Check if operator already has an active batch
      const activeBatch = await batchesService.getActiveBatch(operatorId);
      if (activeBatch) {
        return res.status(400).json({
          success: false,
          message: 'You already have an active batch. Please complete or abort it first.',
          data: activeBatch,
        });
      }

      const batch = await batchesService.startBatch({
        recipeId: parseInt(recipeId, 10),
        operatorId,
        equipmentId: equipmentId ? parseInt(equipmentId, 10) : undefined,
      });

      return res.status(201).json({
        success: true,
        data: batch,
        message: 'Batch started successfully',
      });
    } catch (error: any) {
      logger.error('Error starting batch:', error);

      return res.status(500).json({
        success: false,
        message: 'Failed to start batch',
        error: error.message,
      });
    }
  }

  /**
   * POST /api/batches/:id/log-step
   * Log a step in a batch
   */
  async logStep(req: Request, res: Response) {
    try {
      const batchId = parseInt(req.params.id, 10);

      if (isNaN(batchId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid batch ID',
        });
      }

      const { stepId, materialId, actualWeight, setpointSnapshot, toleranceSnapshot, scannedQrCode } =
        req.body;

      // Validation
      if (
        !stepId ||
        !materialId ||
        actualWeight === undefined ||
        setpointSnapshot === undefined ||
        toleranceSnapshot === undefined
      ) {
        return res.status(400).json({
          success: false,
          message: 'stepId, materialId, actualWeight, setpointSnapshot, and toleranceSnapshot are required',
        });
      }

      if (actualWeight < 0) {
        return res.status(400).json({
          success: false,
          message: 'Actual weight cannot be negative',
        });
      }

      if (setpointSnapshot <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Setpoint must be greater than 0',
        });
      }

      if (toleranceSnapshot < 0 || toleranceSnapshot > 100) {
        return res.status(400).json({
          success: false,
          message: 'Tolerance percent must be between 0 and 100',
        });
      }

      const log = await batchesService.logStep(batchId, {
        stepId: parseInt(stepId, 10),
        materialId: parseInt(materialId, 10),
        actualWeight: parseFloat(actualWeight),
        setpointSnapshot: parseFloat(setpointSnapshot),
        toleranceSnapshot: parseFloat(toleranceSnapshot),
        scannedQrCode,
      });

      return res.status(201).json({
        success: true,
        data: log,
        message: 'Step logged successfully',
      });
    } catch (error: any) {
      logger.error(`Error logging step for batch ${req.params.id}:`, error);

      return res.status(500).json({
        success: false,
        message: 'Failed to log step',
        error: error.message,
      });
    }
  }

  /**
   * PUT /api/batches/:id/end
   * End a batch
   */
  async endBatch(req: Request, res: Response) {
    try {
      const batchId = parseInt(req.params.id, 10);

      if (isNaN(batchId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid batch ID',
        });
      }

      const { status } = req.body;

      // Validation
      if (!status || !['COMPLETED', 'ABORTED'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Status must be either COMPLETED or ABORTED',
        });
      }

      const batch = await batchesService.endBatch(batchId, { status });

      return res.json({
        success: true,
        data: batch,
        message: `Batch ${status.toLowerCase()} successfully`,
      });
    } catch (error: any) {
      logger.error(`Error ending batch ${req.params.id}:`, error);

      if (error.message === 'Batch not found') {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      if (error.message.includes('Cannot complete batch')) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to end batch',
        error: error.message,
      });
    }
  }

  /**
   * GET /api/batches/active
   * Get the current active batch for the authenticated operator
   */
  async getActiveBatch(req: Request, res: Response) {
    try {
      const operatorId = req.user!.userId;

      const batch = await batchesService.getActiveBatch(operatorId);

      if (!batch) {
        return res.json({
          success: true,
          data: null,
          message: 'No active batch found',
        });
      }

      return res.json({
        success: true,
        data: batch,
      });
    } catch (error: any) {
      logger.error('Error fetching active batch:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch active batch',
        error: error.message,
      });
    }
  }

  /**
   * GET /api/batches/statistics
   * Get batch statistics
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

      const statistics = await batchesService.getBatchStatistics(filters);

      return res.json({
        success: true,
        data: statistics,
      });
    } catch (error: any) {
      logger.error('Error fetching batch statistics:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch batch statistics',
        error: error.message,
      });
    }
  }

  /**
   * POST /api/batches/process/start
   * Start a new process batch
   */
  async startProcessBatch(req: Request, res: Response) {
    try {
      const { recipeId, equipmentId } = req.body;
      const operatorId = req.user!.userId;

      if (!recipeId) {
        return res.status(400).json({
          success: false,
          message: 'Recipe ID is required',
        });
      }

      const batch = await batchesService.startProcessBatch({
        recipeId: parseInt(recipeId, 10),
        operatorId,
        equipmentId: equipmentId ? parseInt(equipmentId, 10) : undefined,
      });

      return res.status(201).json({
        success: true,
        data: batch,
        message: 'Process batch started successfully',
      });
    } catch (error: any) {
      logger.error('Error starting process batch:', error);

      return res.status(500).json({
        success: false,
        message: 'Failed to start process batch',
        error: error.message,
      });
    }
  }

  /**
   * POST /api/batches/process/:id/log-step
   * Log a step in a process batch with QR code generation
   */
  async logProcessStep(req: Request, res: Response) {
    try {
      const batchId = parseInt(req.params.id, 10);

      if (isNaN(batchId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid batch ID',
        });
      }

      const { stepId, materialId, actualWeight, setpointSnapshot, toleranceSnapshot, generatedQrCode } =
        req.body;

      // Validation
      if (
        !stepId ||
        !materialId ||
        actualWeight === undefined ||
        setpointSnapshot === undefined ||
        toleranceSnapshot === undefined ||
        !generatedQrCode
      ) {
        return res.status(400).json({
          success: false,
          message:
            'stepId, materialId, actualWeight, setpointSnapshot, toleranceSnapshot, and generatedQrCode are required',
        });
      }

      if (actualWeight < 0) {
        return res.status(400).json({
          success: false,
          message: 'Actual weight cannot be negative',
        });
      }

      if (setpointSnapshot <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Setpoint must be greater than 0',
        });
      }

      if (toleranceSnapshot < 0 || toleranceSnapshot > 100) {
        return res.status(400).json({
          success: false,
          message: 'Tolerance percent must be between 0 and 100',
        });
      }

      const log = await batchesService.logProcessStep(batchId, {
        stepId: parseInt(stepId, 10),
        materialId: parseInt(materialId, 10),
        actualWeight: parseFloat(actualWeight),
        setpointSnapshot: parseFloat(setpointSnapshot),
        toleranceSnapshot: parseFloat(toleranceSnapshot),
        generatedQrCode,
      });

      return res.status(201).json({
        success: true,
        data: log,
        message: 'Process step logged successfully',
      });
    } catch (error: any) {
      logger.error(`Error logging process step for batch ${req.params.id}:`, error);

      return res.status(500).json({
        success: false,
        message: 'Failed to log process step',
        error: error.message,
      });
    }
  }

  /**
   * PUT /api/batches/process/:id/complete
   * Complete a process batch
   */
  async completeProcessBatch(req: Request, res: Response) {
    try {
      const batchId = parseInt(req.params.id, 10);

      if (isNaN(batchId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid batch ID',
        });
      }

      const batch = await batchesService.completeProcessBatch(batchId);

      return res.json({
        success: true,
        data: batch,
        message: 'Process batch completed successfully',
      });
    } catch (error: any) {
      logger.error(`Error completing process batch ${req.params.id}:`, error);

      if (error.message === 'Batch not found') {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      if (error.message.includes('Cannot complete process batch')) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to complete process batch',
        error: error.message,
      });
    }
  }

  /**
   * GET /api/batches/processed
   * Get all processed batches
   */
  async getProcessedBatches(req: Request, res: Response) {
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

      const batches = await batchesService.getProcessedBatches(filters);

      return res.json({
        success: true,
        data: batches,
      });
    } catch (error: any) {
      logger.error('Error fetching processed batches:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch processed batches',
        error: error.message,
      });
    }
  }
}
