import { Router } from 'express';
import { RecipesController } from './recipes.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/roles';

const router = Router();
const recipesController = new RecipesController();

// All routes require authentication
router.use(authenticate);

/**
 * GET /api/recipes
 * Get all recipes (both operators and admins can view)
 */
router.get('/', recipesController.getAllRecipes.bind(recipesController));

/**
 * GET /api/recipes/:id
 * Get a single recipe by ID
 */
router.get('/:id', recipesController.getRecipeById.bind(recipesController));

/**
 * POST /api/recipes
 * Create a new recipe (admin only)
 */
router.post('/', requireRole('ADMIN'), recipesController.createRecipe.bind(recipesController));

/**
 * PUT /api/recipes/:id
 * Update a recipe (admin only)
 */
router.put('/:id', requireRole('ADMIN'), recipesController.updateRecipe.bind(recipesController));

/**
 * DELETE /api/recipes/:id
 * Delete a recipe (admin only)
 */
router.delete('/:id', requireRole('ADMIN'), recipesController.deleteRecipe.bind(recipesController));

export default router;
