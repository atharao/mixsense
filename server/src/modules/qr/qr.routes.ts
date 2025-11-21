import { Router } from 'express';
import { QRController } from './qr.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();
const qrController = new QRController();

// All routes require authentication
router.use(authenticate);

/**
 * POST /api/qr/generate
 * Generate a QR code
 */
router.post('/generate', qrController.generateQRCode.bind(qrController));

/**
 * POST /api/qr/validate
 * Validate a scanned QR code
 */
router.post('/validate', qrController.validateQRCode.bind(qrController));

/**
 * GET /api/qr/batch-log/:id
 * Generate QR code for a batch log
 */
router.get('/batch-log/:id', qrController.generateBatchLogQR.bind(qrController));

/**
 * GET /api/qr/recipe/:id
 * Generate bulk QR codes for a recipe
 */
router.get('/recipe/:id', qrController.generateRecipeQRCodes.bind(qrController));

export default router;
