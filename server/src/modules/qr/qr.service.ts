import { PrismaClient } from '@prisma/client';
import QRCode from 'qrcode';
import crypto from 'crypto';

const prisma = new PrismaClient();

interface QRCodeData {
  materialCode: string;
  materialName: string;
  setpoint: number;
  actualValue: number;
  equipment: string;
  timestamp: number;
  signature: string;
}

export class QRService {
  private secretKey: string;

  constructor() {
    // In production, this should come from environment variables
    this.secretKey = process.env.QR_SECRET_KEY || 'mixsense-qr-secret-key-2024';
  }

  /**
   * Generate a signed QR code with material data
   */
  async generateQRCode(data: {
    materialCode: string;
    materialName: string;
    setpoint: number;
    actualValue: number;
    equipment: string;
  }): Promise<{ qrCodeData: string; qrCodeImage: string }> {
    const timestamp = Date.now();

    // Create QR data payload
    const payload: Omit<QRCodeData, 'signature'> = {
      materialCode: data.materialCode,
      materialName: data.materialName,
      setpoint: data.setpoint,
      actualValue: data.actualValue,
      equipment: data.equipment,
      timestamp,
    };

    // Create signature to prevent tampering
    const signature = this.createSignature(payload);

    const qrData: QRCodeData = {
      ...payload,
      signature,
    };

    // Encode as JSON string
    const qrCodeData = JSON.stringify(qrData);

    // Generate QR code image (base64)
    const qrCodeImage = await QRCode.toDataURL(qrCodeData, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 300,
      margin: 2,
    });

    return {
      qrCodeData,
      qrCodeImage,
    };
  }

  /**
   * Validate a scanned QR code
   */
  async validateQRCode(data: {
    qrCode: string;
    expectedMaterialId: number;
    stepId: number;
  }): Promise<{
    valid: boolean;
    message: string;
    data?: QRCodeData;
    materialMatch?: boolean;
  }> {
    try {
      // Parse QR code data
      const qrData: QRCodeData = JSON.parse(data.qrCode);

      // Verify signature
      const { signature, ...payload } = qrData;
      const expectedSignature = this.createSignature(payload);

      if (signature !== expectedSignature) {
        return {
          valid: false,
          message: 'QR code signature is invalid. Possible tampering detected.',
        };
      }

      // Check if QR code is not too old (e.g., 24 hours)
      const now = Date.now();
      const age = now - qrData.timestamp;
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      if (age > maxAge) {
        return {
          valid: false,
          message: 'QR code has expired. Please generate a new one.',
        };
      }

      // Verify material matches expected
      const material = await prisma.material.findUnique({
        where: { id: data.expectedMaterialId },
      });

      if (!material) {
        return {
          valid: false,
          message: 'Expected material not found in database.',
        };
      }

      const materialMatch = material.code === qrData.materialCode;

      if (!materialMatch) {
        return {
          valid: false,
          message: `Material mismatch. Expected ${material.code} but scanned ${qrData.materialCode}.`,
          data: qrData,
          materialMatch: false,
        };
      }

      // Verify step exists
      const step = await prisma.recipeStep.findUnique({
        where: { id: data.stepId },
        include: {
          material: true,
          recipe: true,
        },
      });

      if (!step) {
        return {
          valid: false,
          message: 'Step not found in database.',
        };
      }

      // Check if material matches step
      if (step.materialId !== data.expectedMaterialId) {
        return {
          valid: false,
          message: 'Material does not match the current recipe step.',
        };
      }

      return {
        valid: true,
        message: 'QR code is valid.',
        data: qrData,
        materialMatch: true,
      };
    } catch (error: any) {
      return {
        valid: false,
        message: `Invalid QR code format: ${error.message}`,
      };
    }
  }

  /**
   * Generate QR code for a batch log
   */
  async generateBatchLogQR(batchLogId: number): Promise<{ qrCodeImage: string; qrCodeData: string }> {
    const log = await prisma.batchLog.findUnique({
      where: { id: batchLogId },
      include: {
        material: true,
        batch: {
          include: {
            equipment: true,
          },
        },
      },
    });

    if (!log) {
      throw new Error('Batch log not found');
    }

    return await this.generateQRCode({
      materialCode: log.material.code,
      materialName: log.material.name,
      setpoint: log.setpointSnapshot,
      actualValue: log.actualWeight,
      equipment: log.batch.equipment?.name || 'N/A',
    });
  }

  /**
   * Create a cryptographic signature for QR code data
   */
  private createSignature(data: Omit<QRCodeData, 'signature'>): string {
    const payload = JSON.stringify({
      materialCode: data.materialCode,
      materialName: data.materialName,
      setpoint: data.setpoint,
      actualValue: data.actualValue,
      equipment: data.equipment,
      timestamp: data.timestamp,
    });

    return crypto.createHmac('sha256', this.secretKey).update(payload).digest('hex');
  }

  /**
   * Generate bulk QR codes for a recipe
   */
  async generateRecipeQRCodes(recipeId: number): Promise<
    Array<{
      stepOrder: number;
      materialName: string;
      materialCode: string;
      qrCodeImage: string;
      qrCodeData: string;
    }>
  > {
    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId },
      include: {
        steps: {
          include: {
            material: true,
            equipment: true,
          },
          orderBy: {
            stepOrder: 'asc',
          },
        },
      },
    });

    if (!recipe) {
      throw new Error('Recipe not found');
    }

    const qrCodes = await Promise.all(
      recipe.steps.map(async (step) => {
        const { qrCodeImage, qrCodeData } = await this.generateQRCode({
          materialCode: step.material.code,
          materialName: step.material.name,
          setpoint: step.setpoint,
          actualValue: step.setpoint, // For pre-generation, use setpoint as placeholder
          equipment: step.equipment?.name || 'Any',
        });

        return {
          stepOrder: step.stepOrder,
          materialName: step.material.name,
          materialCode: step.material.code,
          qrCodeImage,
          qrCodeData,
        };
      })
    );

    return qrCodes;
  }
}
