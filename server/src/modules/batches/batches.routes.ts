import { Router } from 'express';
import { BatchesController } from './batches.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/roles';

const router = Router();
const batchesController = new BatchesController();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/batches/active
 * Get the current active batch for the authenticated operator
 */
router.get('/active', batchesController.getActiveBatch.bind(batchesController));

/**
 * GET /api/batches/statistics
 * Get batch statistics (admin only)
 */
router.get(
  '/statistics',
  requireRole('ADMIN'),
  batchesController.getStatistics.bind(batchesController),
);

/**
 * GET /api/batches/processed
 * Get all processed batches
 */
router.get('/processed', batchesController.getProcessedBatches.bind(batchesController));

/**
 * POST /api/batches/process/start
 * Start a new process batch
 */
router.post('/process/start', batchesController.startProcessBatch.bind(batchesController));

/**
 * POST /api/batches/process/:id/log-step
 * Log a step in a process batch with QR code
 */
router.post('/process/:id/log-step', batchesController.logProcessStep.bind(batchesController));

/**
 * PUT /api/batches/process/:id/complete
 * Complete a process batch
 */
router.put('/process/:id/complete', batchesController.completeProcessBatch.bind(batchesController));

/**
 * GET /api/batches
 * Get all batches with optional filters
 */
router.get('/', batchesController.getAllBatches.bind(batchesController));

/**
 * GET /api/batches/:id
 * Get a single batch by ID
 */
router.get('/:id', batchesController.getBatchById.bind(batchesController));

/**
 * POST /api/batches/start
 * Start a new batch
 */
router.post('/start', batchesController.startBatch.bind(batchesController));

/**
 * POST /api/batches/:id/log-step
 * Log a step in a batch
 */
router.post('/:id/log-step', batchesController.logStep.bind(batchesController));

/**
 * PUT /api/batches/:id/end
 * End a batch
 */
router.put('/:id/end', batchesController.endBatch.bind(batchesController));

export default router;
