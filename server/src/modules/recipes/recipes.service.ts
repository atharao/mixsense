import { RecipeStep, Material } from '@prisma/client';
import { prisma } from '../../config/db';

// Helper function to transform recipe data and convert Decimal to number
function transformRecipe(recipe: any) {
  return {
    ...recipe,
    steps: recipe.steps?.map(
      (step: RecipeStep & { material?: Material; equipment?: Material | null }) => ({
        ...step,
        setpoint: Number(step.setpoint),
        tolerancePercent: Number(step.tolerancePercent),
      }),
    ),
  };
}

export class RecipesService {
  /**
   * Get all recipes with their steps
   */
  async getAllRecipes() {
    const recipes = await prisma.recipe.findMany({
      where: {
        deletedAt: null, // Only show non-deleted recipes
      },
      include: {
        steps: {
          include: {
            material: true,
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

    return recipes.map(transformRecipe);
  }

  /**
   * Get a single recipe by ID with steps
   */
  async getRecipeById(id: number) {
    const recipe = await prisma.recipe.findFirst({
      where: {
        id,
        deletedAt: null, // Only fetch non-deleted recipes
      },
      include: {
        steps: {
          include: {
            material: true,
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

    return transformRecipe(recipe);
  }

  /**
   * Create a new recipe with steps
   */
  async createRecipe(data: {
    name: string;
    createdByUserId: number;
    steps: Array<{
      materialId: number;

      stepOrder: number;
      setpoint: number;
      tolerancePercent: number;
    }>;
  }) {
    // Validate that all materials exist
    const materialIds = data.steps.map(s => s.materialId);
    const uniqueMaterialIds = [...new Set(materialIds)];
    const materials = await prisma.material.findMany({
      where: {
        id: { in: uniqueMaterialIds },
      },
    });

    if (materials.length !== uniqueMaterialIds.length) {
      throw new Error('One or more materials not found');
    }

    // Create recipe with steps in a transaction
    const recipe = await prisma.recipe.create({
      data: {
        name: data.name,
        createdByUserId: data.createdByUserId,
        steps: {
          create: data.steps.map(step => ({
            materialId: step.materialId,

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
          },
          orderBy: {
            stepOrder: 'asc',
          },
        },
      },
    });

    return transformRecipe(recipe);
  }

  /**
   * Update a recipe and its steps
   */
  async updateRecipe(
    id: number,
    data: {
      name?: string;
      updatedByUserId?: number;
      steps?: Array<{
        id?: number;
        materialId: number;

        stepOrder: number;
        setpoint: number;
        tolerancePercent: number;
      }>;
    },
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
      const materialIds = data.steps.map(s => s.materialId);
      const uniqueMaterialIds = [...new Set(materialIds)];
      const materials = await prisma.material.findMany({
        where: {
          id: { in: uniqueMaterialIds },
        },
      });

      if (materials.length !== uniqueMaterialIds.length) {
        throw new Error('One or more materials not found');
      }
    }

    // Update recipe in a transaction
    const recipe = await prisma.$transaction(async tx => {
      // Prepare update data
      const updateData: any = {};

      if (data.name !== undefined) {
        updateData.name = data.name;
      }

      if (data.updatedByUserId !== undefined) {
        updateData.updatedByUserId = data.updatedByUserId;
      }

      // Update recipe if there's data to update
      if (Object.keys(updateData).length > 0) {
        await tx.recipe.update({
          where: { id },
          data: updateData,
        });
      }

      // If steps are provided, replace all steps
      if (data.steps) {
        // Delete existing steps
        await tx.recipeStep.deleteMany({
          where: { recipeId: id },
        });

        // Create new steps
        await tx.recipeStep.createMany({
          data: data.steps.map(step => ({
            recipeId: id,
            materialId: step.materialId,

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
            },
            orderBy: {
              stepOrder: 'asc',
            },
          },
        },
      });
    });

    return transformRecipe(recipe!);
  }

  /**
   * Delete a recipe (soft delete)
   */
  async deleteRecipe(id: number, deletedByUserId: number) {
    // Check if recipe exists and is not already deleted
    await this.getRecipeById(id);

    // Soft delete - set deletedAt and deletedByUserId
    await prisma.recipe.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedByUserId,
      },
    });

    return { success: true };
  }
}
