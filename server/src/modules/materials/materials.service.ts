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
}

export class MaterialsService {
  async getAllMaterials() {
    const materials = await prisma.material.findMany({
      include: {
        createdBy: {
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
    const material = await prisma.material.findUnique({
      where: { id },
      include: {
        createdBy: {
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
      },
    });

    logger.info(`Material updated: ${material.name} (${material.code})`);

    return material;
  }

  async deleteMaterial(id: number) {
    // Check if material exists
    await this.getMaterialById(id);

    // Check if material is used in any recipe steps
    const usedInSteps = await prisma.recipeStep.count({
      where: { materialId: id },
    });

    if (usedInSteps > 0) {
      throw new Error('Cannot delete material as it is used in recipe steps');
    }

    await prisma.material.delete({
      where: { id },
    });

    logger.info(`Material deleted: ID ${id}`);

    return { success: true };
  }

  async getMaterialByCode(code: string) {
    const material = await prisma.material.findUnique({
      where: { code },
      include: {
        createdBy: {
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
