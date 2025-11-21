import { Router } from 'express';
import * as materialsController from './materials.controller';
import { auth } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/roles';

const router = Router();

// All routes require authentication and admin role
router.use(auth, requireAdmin);

// Get all materials (with optional type filter)
router.get('/', materialsController.listMaterials);

// Get ingredients only
router.get('/ingredients', materialsController.getIngredients);

// Get equipment only
router.get('/equipment', materialsController.getEquipment);

// Get material by code
router.get('/code/:code', materialsController.getMaterialByCode);

// Get material by ID
router.get('/:id', materialsController.getMaterial);

// Create new material
router.post('/', materialsController.createMaterial);

// Update material
router.put('/:id', materialsController.updateMaterial);

// Delete material
router.delete('/:id', materialsController.deleteMaterial);

export default router;
