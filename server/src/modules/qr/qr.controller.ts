import { Request, Response } from 'express';
import { QRService } from './qr.service';
import { logger } from '../../utils/logger';

const qrService = new QRService();

export class QRController {
  /**
   * POST /api/qr/generate
   * Generate a QR code
   */
  async generateQRCode(req: Request, res: Response) {
    try {
      const { materialCode, materialName, setpoint, actualValue, equipment } = req.body;

      // Validation
      if (!materialCode || !materialName || setpoint === undefined || actualValue === undefined || !equipment) {
        return res.status(400).json({
          success: false,
          message: 'materialCode, materialName, setpoint, actualValue, and equipment are required',
        });
      }

      if (setpoint <= 0 || actualValue < 0) {
        return res.status(400).json({
          success: false,
          message: 'setpoint and actualValue must be positive numbers',
        });
      }

      const result = await qrService.generateQRCode({
        materialCode,
        materialName,
        setpoint: parseFloat(setpoint),
        actualValue: parseFloat(actualValue),
        equipment,
      });

      res.json({
        success: true,
        data: result,
        message: 'QR code generated successfully',
      });
    } catch (error: any) {
      logger.error('Error generating QR code:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate QR code',
        error: error.message,
      });
    }
  }

  /**
   * POST /api/qr/validate
   * Validate a scanned QR code
   */
  async validateQRCode(req: Request, res: Response) {
    try {
      const { qrCode, expectedMaterialId, stepId } = req.body;

      // Validation
      if (!qrCode || !expectedMaterialId || !stepId) {
        return res.status(400).json({
          success: false,
          message: 'qrCode, expectedMaterialId, and stepId are required',
        });
      }

      const result = await qrService.validateQRCode({
        qrCode,
        expectedMaterialId: parseInt(expectedMaterialId, 10),
        stepId: parseInt(stepId, 10),
      });

      if (!result.valid) {
        return res.status(400).json({
          success: false,
          message: result.message,
          data: result.data,
          materialMatch: result.materialMatch,
        });
      }

      res.json({
        success: true,
        message: result.message,
        data: result.data,
        materialMatch: result.materialMatch,
      });
    } catch (error: any) {
      logger.error('Error validating QR code:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to validate QR code',
        error: error.message,
      });
    }
  }

  /**
   * GET /api/qr/batch-log/:id
   * Generate QR code for a batch log
   */
  async generateBatchLogQR(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);

      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid batch log ID',
        });
      }

      const result = await qrService.generateBatchLogQR(id);

      res.json({
        success: true,
        data: result,
        message: 'QR code generated successfully',
      });
    } catch (error: any) {
      logger.error(`Error generating QR code for batch log ${req.params.id}:`, error);

      if (error.message === 'Batch log not found') {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to generate QR code',
        error: error.message,
      });
    }
  }

  /**
   * GET /api/qr/recipe/:id
   * Generate bulk QR codes for a recipe
   */
  async generateRecipeQRCodes(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);

      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid recipe ID',
        });
      }

      const result = await qrService.generateRecipeQRCodes(id);

      res.json({
        success: true,
        data: result,
        message: 'QR codes generated successfully',
      });
    } catch (error: any) {
      logger.error(`Error generating QR codes for recipe ${req.params.id}:`, error);

      if (error.message === 'Recipe not found') {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to generate QR codes',
        error: error.message,
      });
    }
  }
}
