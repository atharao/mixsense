import { Router } from 'express';
import * as authController from './auth.controller';
import { auth } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/roles';

const router = Router();

// Public routes
router.post('/login', authController.login);
router.post('/logout', authController.logout);

// Protected routes
router.get('/me', auth, authController.me);
router.post('/change-password', auth, authController.changePassword);

// Admin only - user management
router.get('/users', auth, requireAdmin, authController.getAllUsers);
router.post('/users', auth, requireAdmin, authController.createUser);
router.put('/users/:id', auth, requireAdmin, authController.updateUser);
router.delete('/users/:id', auth, requireAdmin, authController.deleteUser);

export default router;
