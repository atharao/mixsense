import { prisma } from '../../config/db';
import { logger } from '../../utils/logger';

export interface CreateMaterialData {
  name: string;
  code: string;
  createdByUserId: number;
}

export interface UpdateMaterialData {
  name?: string;
  code?: string;
  updatedByUserId?: number;
}

export class MaterialsService {
  async getAllMaterials() {
    const materials = await prisma.material.findMany({
      where: {
        deletedAt: null, // Only show non-deleted materials
      },
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
          },
        },
        updatedBy: {
          select: {
            id: true,
            username: true,
          },
        },
        deletedBy: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return materials;
  }

  async getMaterialById(id: number) {
    const material = await prisma.material.findFirst({
      where: {
        id,
        deletedAt: null, // Only fetch non-deleted materials
      },
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
          },
        },
        updatedBy: {
          select: {
            id: true,
            username: true,
          },
        },
        deletedBy: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    if (!material) {
      throw new Error('Material not found');
    }

    return material;
  }

  async createMaterial(data: CreateMaterialData) {
    const material = await prisma.material.create({
      data,
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
          },
        },
        updatedBy: {
          select: {
            id: true,
            username: true,
          },
        },
        deletedBy: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    logger.info(
      `Material created: ${material.name} (${material.code}) by user ${data.createdByUserId}`,
    );

    return material;
  }

  async updateMaterial(id: number, data: UpdateMaterialData) {
    // Check if material exists
    await this.getMaterialById(id);

    const material = await prisma.material.update({
      where: { id },
      data,
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
          },
        },
        updatedBy: {
          select: {
            id: true,
            username: true,
          },
        },
        deletedBy: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    logger.info(
      `Material updated: ${material.name} (${material.code}) by user ${data.updatedByUserId || 'unknown'}`,
    );

    return material;
  }

  async deleteMaterial(id: number, deletedByUserId: number) {
    // Check if material exists and is not already deleted
    const material = await this.getMaterialById(id);

    // Soft delete - set deletedAt and deletedByUserId
    await prisma.material.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedByUserId,
      },
    });

    logger.info(
      `Material soft-deleted: ${material.name} (${material.code}) by user ${deletedByUserId}`,
    );

    return { success: true };
  }

  async getMaterialByCode(code: string) {
    const material = await prisma.material.findFirst({
      where: {
        code,
        deletedAt: null, // Only find non-deleted materials
      },
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
          },
        },
        updatedBy: {
          select: {
            id: true,
            username: true,
          },
        },
        deletedBy: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    });

    return material;
  }
}
