import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class RecipesService {
  /**
   * Get all recipes with their steps
   */
  async getAllRecipes() {
    return await prisma.recipe.findMany({
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
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Get a single recipe by ID with steps
   */
  async getRecipeById(id: number) {
    const recipe = await prisma.recipe.findUnique({
      where: { id },
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

    return recipe;
  }

  /**
   * Create a new recipe with steps
   */
  async createRecipe(data: {
    name: string;
    createdByUserId: number;
    steps: Array<{
      materialId: number;
      equipmentId?: number;
      stepOrder: number;
      setpoint: number;
      tolerancePercent: number;
    }>;
  }) {
    // Validate that all materials exist
    const materialIds = data.steps.map((s) => s.materialId);
    const materials = await prisma.material.findMany({
      where: {
        id: { in: materialIds },
      },
    });

    if (materials.length !== materialIds.length) {
      throw new Error('One or more materials not found');
    }

    // Validate equipment if provided
    const equipmentIds = data.steps
      .map((s) => s.equipmentId)
      .filter((id): id is number => id !== undefined);

    if (equipmentIds.length > 0) {
      const equipment = await prisma.material.findMany({
        where: {
          id: { in: equipmentIds },
          type: 'EQUIPMENT',
        },
      });

      if (equipment.length !== equipmentIds.length) {
        throw new Error('One or more equipment not found or not of type EQUIPMENT');
      }
    }

    // Create recipe with steps in a transaction
    const recipe = await prisma.recipe.create({
      data: {
        name: data.name,
        createdByUserId: data.createdByUserId,
        steps: {
          create: data.steps.map((step) => ({
            materialId: step.materialId,
            equipmentId: step.equipmentId,
            stepOrder: step.stepOrder,
            setpoint: step.setpoint,
            tolerancePercent: step.tolerancePercent,
          })),
        },
      },
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

    return recipe;
  }

  /**
   * Update a recipe and its steps
   */
  async updateRecipe(
    id: number,
    data: {
      name?: string;
      steps?: Array<{
        id?: number;
        materialId: number;
        equipmentId?: number;
        stepOrder: number;
        setpoint: number;
        tolerancePercent: number;
      }>;
    }
  ) {
    // Check if recipe exists
    const existingRecipe = await prisma.recipe.findUnique({
      where: { id },
      include: { steps: true },
    });

    if (!existingRecipe) {
      throw new Error('Recipe not found');
    }

    // If steps are being updated, validate materials
    if (data.steps) {
      const materialIds = data.steps.map((s) => s.materialId);
      const materials = await prisma.material.findMany({
        where: {
          id: { in: materialIds },
        },
      });

      if (materials.length !== materialIds.length) {
        throw new Error('One or more materials not found');
      }

      // Validate equipment if provided
      const equipmentIds = data.steps
        .map((s) => s.equipmentId)
        .filter((id): id is number => id !== undefined);

      if (equipmentIds.length > 0) {
        const equipment = await prisma.material.findMany({
          where: {
            id: { in: equipmentIds },
            type: 'EQUIPMENT',
          },
        });

        if (equipment.length !== equipmentIds.length) {
          throw new Error('One or more equipment not found or not of type EQUIPMENT');
        }
      }
    }

    // Update recipe in a transaction
    const recipe = await prisma.$transaction(async (tx) => {
      // Update recipe name if provided
      await tx.recipe.update({
        where: { id },
        data: {
          name: data.name,
        },
      });

      // If steps are provided, replace all steps
      if (data.steps) {
        // Delete existing steps
        await tx.recipeStep.deleteMany({
          where: { recipeId: id },
        });

        // Create new steps
        await tx.recipeStep.createMany({
          data: data.steps.map((step) => ({
            recipeId: id,
            materialId: step.materialId,
            equipmentId: step.equipmentId,
            stepOrder: step.stepOrder,
            setpoint: step.setpoint,
            tolerancePercent: step.tolerancePercent,
          })),
        });
      }

      // Fetch the complete updated recipe
      return await tx.recipe.findUnique({
        where: { id },
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
    });

    return recipe;
  }

  /**
   * Delete a recipe
   */
  async deleteRecipe(id: number) {
    // Check if recipe exists
    const recipe = await prisma.recipe.findUnique({
      where: { id },
    });

    if (!recipe) {
      throw new Error('Recipe not found');
    }

    // Check if recipe is being used in any batches
    const batchesUsingRecipe = await prisma.batch.findFirst({
      where: { recipeId: id },
    });

    if (batchesUsingRecipe) {
      throw new Error('Cannot delete recipe that is used in batches');
    }

    // Delete recipe (steps will be cascade deleted)
    await prisma.recipe.delete({
      where: { id },
    });

    return { success: true };
  }
}
