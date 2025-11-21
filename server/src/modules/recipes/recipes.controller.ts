import { Request, Response } from 'express';
import { RecipesService } from './recipes.service';
import { logger } from '../../utils/logger';

const recipesService = new RecipesService();

export class RecipesController {
  /**
   * GET /api/recipes
   * Get all recipes
   */
  async getAllRecipes(req: Request, res: Response) {
    try {
      const recipes = await recipesService.getAllRecipes();
      res.json({
        success: true,
        data: recipes,
      });
    } catch (error: any) {
      logger.error('Error fetching recipes:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch recipes',
        error: error.message,
      });
    }
  }

  /**
   * GET /api/recipes/:id
   * Get a single recipe by ID
   */
  async getRecipeById(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);

      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid recipe ID',
        });
      }

      const recipe = await recipesService.getRecipeById(id);
      res.json({
        success: true,
        data: recipe,
      });
    } catch (error: any) {
      logger.error(`Error fetching recipe ${req.params.id}:`, error);

      if (error.message === 'Recipe not found') {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to fetch recipe',
        error: error.message,
      });
    }
  }

  /**
   * POST /api/recipes
   * Create a new recipe
   */
  async createRecipe(req: Request, res: Response) {
    try {
      const { name, steps } = req.body;

      // Validation
      if (!name || !steps || !Array.isArray(steps) || steps.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Recipe name and at least one step are required',
        });
      }

      // Validate each step
      for (const step of steps) {
        if (
          !step.materialId ||
          step.stepOrder === undefined ||
          step.setpoint === undefined ||
          step.tolerancePercent === undefined
        ) {
          return res.status(400).json({
            success: false,
            message: 'Each step must have materialId, stepOrder, setpoint, and tolerancePercent',
          });
        }

        if (step.setpoint <= 0) {
          return res.status(400).json({
            success: false,
            message: 'Setpoint must be greater than 0',
          });
        }

        if (step.tolerancePercent < 0 || step.tolerancePercent > 100) {
          return res.status(400).json({
            success: false,
            message: 'Tolerance percent must be between 0 and 100',
          });
        }
      }

      const recipe = await recipesService.createRecipe({ name, steps });

      res.status(201).json({
        success: true,
        data: recipe,
        message: 'Recipe created successfully',
      });
    } catch (error: any) {
      logger.error('Error creating recipe:', error);

      res.status(500).json({
        success: false,
        message: 'Failed to create recipe',
        error: error.message,
      });
    }
  }

  /**
   * PUT /api/recipes/:id
   * Update a recipe
   */
  async updateRecipe(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);

      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid recipe ID',
        });
      }

      const { name, steps } = req.body;

      // Validate steps if provided
      if (steps) {
        if (!Array.isArray(steps) || steps.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Steps must be a non-empty array',
          });
        }

        for (const step of steps) {
          if (
            !step.materialId ||
            step.stepOrder === undefined ||
            step.setpoint === undefined ||
            step.tolerancePercent === undefined
          ) {
            return res.status(400).json({
              success: false,
              message: 'Each step must have materialId, stepOrder, setpoint, and tolerancePercent',
            });
          }

          if (step.setpoint <= 0) {
            return res.status(400).json({
              success: false,
              message: 'Setpoint must be greater than 0',
            });
          }

          if (step.tolerancePercent < 0 || step.tolerancePercent > 100) {
            return res.status(400).json({
              success: false,
              message: 'Tolerance percent must be between 0 and 100',
            });
          }
        }
      }

      const recipe = await recipesService.updateRecipe(id, { name, steps });

      res.json({
        success: true,
        data: recipe,
        message: 'Recipe updated successfully',
      });
    } catch (error: any) {
      logger.error(`Error updating recipe ${req.params.id}:`, error);

      if (error.message === 'Recipe not found') {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to update recipe',
        error: error.message,
      });
    }
  }

  /**
   * DELETE /api/recipes/:id
   * Delete a recipe
   */
  async deleteRecipe(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id, 10);

      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid recipe ID',
        });
      }

      await recipesService.deleteRecipe(id);

      res.json({
        success: true,
        message: 'Recipe deleted successfully',
      });
    } catch (error: any) {
      logger.error(`Error deleting recipe ${req.params.id}:`, error);

      if (error.message === 'Recipe not found') {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }

      if (error.message.includes('Cannot delete recipe')) {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }

      res.status(500).json({
        success: false,
        message: 'Failed to delete recipe',
        error: error.message,
      });
    }
  }
}
