import { PrismaClient, BatchStatus, RecipeStep, Material } from '@prisma/client';

const prisma = new PrismaClient();

// Helper function to transform recipe steps and convert Decimal to number
function transformRecipeSteps(steps: (RecipeStep & { material?: Material; equipment?: Material | null })[]) {
  return steps.map(step => ({
    ...step,
    setpoint: Number(step.setpoint),
    tolerancePercent: Number(step.tolerancePercent),
  }));
}

// Helper function to transform batch data and convert Decimal to number
function transformBatch(batch: any) {
  return {
    ...batch,
    recipe: batch.recipe ? {
      ...batch.recipe,
      steps: batch.recipe.steps ? transformRecipeSteps(batch.recipe.steps) : [],
    } : undefined,
    logs: batch.logs?.map((log: any) => ({
      ...log,
      actualWeight: Number(log.actualWeight),
      setpointSnapshot: Number(log.setpointSnapshot),
      toleranceSnapshot: Number(log.toleranceSnapshot),
      step: log.step ? {
        ...log.step,
        setpoint: Number(log.step.setpoint),
        tolerancePercent: Number(log.step.tolerancePercent),
      } : undefined,
    })),
  };
}

export class BatchesService {
  /**
   * Get all batches with their logs and related data
   */
  async getAllBatches(filters?: {
    recipeId?: number;
    operatorId?: number;
    startDate?: Date;
    endDate?: Date;
    status?: BatchStatus;
  }) {
    const where: any = {};

    if (filters?.recipeId) {
      where.recipeId = filters.recipeId;
    }

    if (filters?.operatorId) {
      where.operatorUserId = filters.operatorId;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.startDate || filters?.endDate) {
      where.startTime = {};
      if (filters.startDate) {
        where.startTime.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.startTime.lte = filters.endDate;
      }
    }

    const batches = await prisma.batch.findMany({
      where,
      include: {
        recipe: {
          include: {
            steps: {
              include: {
                material: true,
                equipment: true,
              },
            },
          },
        },
        operator: {
          select: {
            id: true,
            username: true,
            role: true,
          },
        },
        equipment: true,
        logs: {
          include: {
            step: {
              include: {
                material: true,
                equipment: true,
              },
            },
            material: true,
          },
          orderBy: {
            timestamp: 'asc',
          },
        },
      },
      orderBy: {
        startTime: 'desc',
      },
    });

    return batches.map(transformBatch);
  }

  /**
   * Get a single batch by ID
   */
  async getBatchById(id: number) {
    const batch = await prisma.batch.findUnique({
      where: { id },
      include: {
        recipe: {
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
        },
        operator: {
          select: {
            id: true,
            username: true,
            role: true,
          },
        },
        equipment: true,
        logs: {
          include: {
            step: {
              include: {
                material: true,
                equipment: true,
              },
            },
            material: true,
          },
          orderBy: {
            timestamp: 'asc',
          },
        },
      },
    });

    if (!batch) {
      throw new Error('Batch not found');
    }

    return transformBatch(batch);
  }

  /**
   * Start a new batch
   */
  async startBatch(data: { recipeId: number; operatorId: number; equipmentId?: number }) {
    // Validate recipe exists
    const recipe = await prisma.recipe.findUnique({
      where: { id: data.recipeId },
      include: {
        steps: true,
      },
    });

    if (!recipe) {
      throw new Error('Recipe not found');
    }

    if (recipe.steps.length === 0) {
      throw new Error('Recipe has no steps');
    }

    // Validate operator exists
    const operator = await prisma.user.findUnique({
      where: { id: data.operatorId },
    });

    if (!operator) {
      throw new Error('Operator not found');
    }

    // Validate equipment if provided
    if (data.equipmentId) {
      const equipment = await prisma.material.findFirst({
        where: {
          id: data.equipmentId,
          type: 'EQUIPMENT',
        },
      });

      if (!equipment) {
        throw new Error('Equipment not found or not of type EQUIPMENT');
      }
    }

    // Create batch
    const batch = await prisma.batch.create({
      data: {
        recipeId: data.recipeId,
        operatorUserId: data.operatorId,
        equipmentId: data.equipmentId,
        startTime: new Date(),
        status: 'IN_PROGRESS',
      },
      include: {
        recipe: {
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
        },
        operator: {
          select: {
            id: true,
            username: true,
            role: true,
          },
        },
        equipment: true,
        logs: true,
      },
    });

    return transformBatch(batch);
  }

  /**
   * Log a step in a batch
   */
  async logStep(
    batchId: number,
    data: {
      stepId: number;
      materialId: number;
      actualWeight: number;
      setpointSnapshot: number;
      toleranceSnapshot: number;
      scannedQrCode?: string;
    }
  ) {
    // Validate batch exists and is in progress
    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
      include: {
        recipe: {
          include: {
            steps: true,
          },
        },
      },
    });

    if (!batch) {
      throw new Error('Batch not found');
    }

    if (batch.status !== 'IN_PROGRESS') {
      throw new Error('Batch is not in progress');
    }

    // Validate step exists in the batch's recipe
    const step = batch.recipe.steps.find((s) => s.id === data.stepId);
    if (!step) {
      throw new Error('Step not found in batch recipe');
    }

    // Validate material exists
    const material = await prisma.material.findUnique({
      where: { id: data.materialId },
    });

    if (!material) {
      throw new Error('Material not found');
    }

    // Validate material matches step
    if (material.id !== step.materialId) {
      throw new Error('Material does not match step requirements');
    }

    // Note: Tolerance validation can be calculated on the fly when needed
    // const toleranceRange = (data.setpointSnapshot * data.toleranceSnapshot) / 100;
    // const lowerBound = data.setpointSnapshot - toleranceRange;
    // const upperBound = data.setpointSnapshot + toleranceRange;
    // const withinTolerance = data.actualWeight >= lowerBound && data.actualWeight <= upperBound;

    // Create batch log
    const log = await prisma.batchLog.create({
      data: {
        batchId,
        stepId: data.stepId,
        materialId: data.materialId,
        actualWeight: data.actualWeight,
        setpointSnapshot: data.setpointSnapshot,
        toleranceSnapshot: data.toleranceSnapshot,
        scannedQrCode: data.scannedQrCode,
      },
      include: {
        step: {
          include: {
            material: true,
            equipment: true,
          },
        },
        material: true,
      },
    });

    return {
      ...log,
      actualWeight: Number(log.actualWeight),
      setpointSnapshot: Number(log.setpointSnapshot),
      toleranceSnapshot: Number(log.toleranceSnapshot),
      step: log.step ? {
        ...log.step,
        setpoint: Number(log.step.setpoint),
        tolerancePercent: Number(log.step.tolerancePercent),
      } : undefined,
    };
  }

  /**
   * End a batch
   */
  async endBatch(batchId: number, data: { status: 'COMPLETED' | 'ABORTED' }) {
    // Validate batch exists and is in progress
    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
      include: {
        recipe: {
          include: {
            steps: true,
          },
        },
        logs: true,
      },
    });

    if (!batch) {
      throw new Error('Batch not found');
    }

    if (batch.status !== 'IN_PROGRESS') {
      throw new Error('Batch is not in progress');
    }

    // If completing, validate all steps are logged
    if (data.status === 'COMPLETED') {
      const recipeStepIds = batch.recipe.steps.map((s) => s.id);
      const loggedStepIds = new Set(batch.logs.map((l) => l.stepId));

      const missingSteps = recipeStepIds.filter((id) => !loggedStepIds.has(id));

      if (missingSteps.length > 0) {
        throw new Error(
          `Cannot complete batch: steps ${missingSteps.join(', ')} have not been logged`
        );
      }
    }

    // Update batch status
    const updatedBatch = await prisma.batch.update({
      where: { id: batchId },
      data: {
        status: data.status,
        endTime: new Date(),
      },
      include: {
        recipe: {
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
        },
        operator: {
          select: {
            id: true,
            username: true,
            role: true,
          },
        },
        equipment: true,
        logs: {
          include: {
            step: {
              include: {
                material: true,
                equipment: true,
              },
            },
            material: true,
          },
          orderBy: {
            timestamp: 'asc',
          },
        },
      },
    });

    return transformBatch(updatedBatch);
  }

  /**
   * Get current active batch for an operator
   */
  async getActiveBatch(operatorId: number) {
    const batch = await prisma.batch.findFirst({
      where: {
        operatorUserId: operatorId,
        status: 'IN_PROGRESS',
      },
      include: {
        recipe: {
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
        },
        operator: {
          select: {
            id: true,
            username: true,
            role: true,
          },
        },
        equipment: true,
        logs: {
          include: {
            step: {
              include: {
                material: true,
                equipment: true,
              },
            },
            material: true,
          },
          orderBy: {
            timestamp: 'asc',
          },
        },
      },
    });

    return batch ? transformBatch(batch) : null;
  }

  /**
   * Get batch statistics
   */
  async getBatchStatistics(filters?: {
    recipeId?: number;
    operatorId?: number;
    startDate?: Date;
    endDate?: Date;
  }) {
    const where: any = {};

    if (filters?.recipeId) {
      where.recipeId = filters.recipeId;
    }

    if (filters?.operatorId) {
      where.operatorUserId = filters.operatorId;
    }

    if (filters?.startDate || filters?.endDate) {
      where.startTime = {};
      if (filters.startDate) {
        where.startTime.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.startTime.lte = filters.endDate;
      }
    }

    const [total, completed, aborted, inProgress] = await Promise.all([
      prisma.batch.count({ where }),
      prisma.batch.count({ where: { ...where, status: 'COMPLETED' } }),
      prisma.batch.count({ where: { ...where, status: 'ABORTED' } }),
      prisma.batch.count({ where: { ...where, status: 'IN_PROGRESS' } }),
    ]);

    return {
      total,
      completed,
      aborted,
      inProgress,
      completionRate: total > 0 ? (completed / total) * 100 : 0,
      abortRate: total > 0 ? (aborted / total) * 100 : 0,
    };
  }

  /**
   * Start a new process batch
   */
  async startProcessBatch(data: { recipeId: number; operatorId: number; equipmentId?: number }) {
    // Validate recipe exists
    const recipe = await prisma.recipe.findUnique({
      where: { id: data.recipeId },
      include: {
        steps: true,
      },
    });

    if (!recipe) {
      throw new Error('Recipe not found');
    }

    if (recipe.steps.length === 0) {
      throw new Error('Recipe has no steps');
    }

    // Validate operator exists
    const operator = await prisma.user.findUnique({
      where: { id: data.operatorId },
    });

    if (!operator) {
      throw new Error('Operator not found');
    }

    // Validate equipment if provided
    if (data.equipmentId) {
      const equipment = await prisma.material.findFirst({
        where: {
          id: data.equipmentId,
          type: 'EQUIPMENT',
        },
      });

      if (!equipment) {
        throw new Error('Equipment not found or not of type EQUIPMENT');
      }
    }

    // Check if operator already has an active process batch
    const existingProcessBatch = await prisma.batch.findFirst({
      where: {
        operatorUserId: data.operatorId,
        status: 'IN_PROGRESS',
      },
    });

    if (existingProcessBatch) {
      throw new Error('Operator already has an active batch');
    }

    // Create process batch with IN_PROGRESS status (will be changed to PROCESSED when complete)
    const batch = await prisma.batch.create({
      data: {
        recipeId: data.recipeId,
        operatorUserId: data.operatorId,
        equipmentId: data.equipmentId,
        startTime: new Date(),
        status: 'IN_PROGRESS',
      },
      include: {
        recipe: {
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
        },
        operator: {
          select: {
            id: true,
            username: true,
            role: true,
          },
        },
        equipment: true,
        logs: true,
      },
    });

    return transformBatch(batch);
  }

  /**
   * Log a step in a process batch with QR code generation
   */
  async logProcessStep(
    batchId: number,
    data: {
      stepId: number;
      materialId: number;
      actualWeight: number;
      setpointSnapshot: number;
      toleranceSnapshot: number;
      generatedQrCode: string;
    }
  ) {
    // Validate batch exists and is in progress
    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
      include: {
        recipe: {
          include: {
            steps: true,
          },
        },
      },
    });

    if (!batch) {
      throw new Error('Batch not found');
    }

    if (batch.status !== 'IN_PROGRESS') {
      throw new Error('Batch is not in progress');
    }

    // Validate step exists in the batch's recipe
    const step = batch.recipe.steps.find((s) => s.id === data.stepId);
    if (!step) {
      throw new Error('Step not found in batch recipe');
    }

    // Validate material exists
    const material = await prisma.material.findUnique({
      where: { id: data.materialId },
    });

    if (!material) {
      throw new Error('Material not found');
    }

    // Validate material matches step
    if (material.id !== step.materialId) {
      throw new Error('Material does not match step requirements');
    }

    // Create batch log with generated QR code
    const log = await prisma.batchLog.create({
      data: {
        batchId,
        stepId: data.stepId,
        materialId: data.materialId,
        actualWeight: data.actualWeight,
        setpointSnapshot: data.setpointSnapshot,
        toleranceSnapshot: data.toleranceSnapshot,
        generatedQrCode: data.generatedQrCode,
      },
      include: {
        step: {
          include: {
            material: true,
            equipment: true,
          },
        },
        material: true,
      },
    });

    return {
      ...log,
      actualWeight: Number(log.actualWeight),
      setpointSnapshot: Number(log.setpointSnapshot),
      toleranceSnapshot: Number(log.toleranceSnapshot),
      step: log.step ? {
        ...log.step,
        setpoint: Number(log.step.setpoint),
        tolerancePercent: Number(log.step.tolerancePercent),
      } : undefined,
    };
  }

  /**
   * Complete a process batch and change status to PROCESSED
   */
  async completeProcessBatch(batchId: number) {
    // Validate batch exists and is in progress
    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
      include: {
        recipe: {
          include: {
            steps: true,
          },
        },
        logs: true,
      },
    });

    if (!batch) {
      throw new Error('Batch not found');
    }

    if (batch.status !== 'IN_PROGRESS') {
      throw new Error('Batch is not in progress');
    }

    // Validate all steps are logged
    const recipeStepIds = batch.recipe.steps.map((s) => s.id);
    const loggedStepIds = new Set(batch.logs.map((l) => l.stepId));

    const missingSteps = recipeStepIds.filter((id) => !loggedStepIds.has(id));

    if (missingSteps.length > 0) {
      throw new Error(
        `Cannot complete process batch: steps ${missingSteps.join(', ')} have not been logged`
      );
    }

    // Update batch status to PROCESSED
    const updatedBatch = await prisma.batch.update({
      where: { id: batchId },
      data: {
        status: 'PROCESSED',
        endTime: new Date(),
      },
      include: {
        recipe: {
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
        },
        operator: {
          select: {
            id: true,
            username: true,
            role: true,
          },
        },
        equipment: true,
        logs: {
          include: {
            step: {
              include: {
                material: true,
                equipment: true,
              },
            },
            material: true,
          },
          orderBy: {
            timestamp: 'asc',
          },
        },
      },
    });

    return transformBatch(updatedBatch);
  }

  /**
   * Get all processed batches
   */
  async getProcessedBatches(filters?: {
    recipeId?: number;
    operatorId?: number;
    startDate?: Date;
    endDate?: Date;
  }) {
    const where: any = { status: 'PROCESSED' };

    if (filters?.recipeId) {
      where.recipeId = filters.recipeId;
    }

    if (filters?.operatorId) {
      where.operatorUserId = filters.operatorId;
    }

    if (filters?.startDate || filters?.endDate) {
      where.startTime = {};
      if (filters.startDate) {
        where.startTime.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.startTime.lte = filters.endDate;
      }
    }

    const batches = await prisma.batch.findMany({
      where,
      include: {
        recipe: {
          include: {
            steps: {
              include: {
                material: true,
                equipment: true,
              },
            },
          },
        },
        operator: {
          select: {
            id: true,
            username: true,
            role: true,
          },
        },
        equipment: true,
        logs: {
          include: {
            step: {
              include: {
                material: true,
                equipment: true,
              },
            },
            material: true,
          },
          orderBy: {
            timestamp: 'asc',
          },
        },
      },
      orderBy: {
        startTime: 'desc',
      },
    });

    return batches.map(transformBatch);
  }
}
