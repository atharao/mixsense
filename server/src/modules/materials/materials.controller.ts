import { Request, Response, NextFunction } from 'express';
import { MaterialsService } from './materials.service';
import { MaterialType } from '@prisma/client';

const materialsService = new MaterialsService();

export const listMaterials = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { type } = req.query;

    const validType =
      type && ['INGREDIENT', 'EQUIPMENT'].includes(type as string)
        ? (type as MaterialType)
        : undefined;

    const materials = await materialsService.getAllMaterials(validType);

    res.status(200).json({
      success: true,
      data: materials,
      count: materials.length,
    });
  } catch (error) {
    next(error);
  }
};

export const getMaterial = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;
    const materialId = parseInt(id, 10);

    if (isNaN(materialId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid material ID',
      });
      return;
    }

    const material = await materialsService.getMaterialById(materialId);

    res.status(200).json({
      success: true,
      data: material,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Material not found') {
      res.status(404).json({
        success: false,
        message: error.message,
      });
      return;
    }
    next(error);
  }
};

export const createMaterial = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { name, code, type } = req.body;

    if (!name || !code || !type) {
      res.status(400).json({
        success: false,
        message: 'Name, code, and type are required',
      });
      return;
    }

    if (!['INGREDIENT', 'EQUIPMENT'].includes(type)) {
      res.status(400).json({
        success: false,
        message: 'Type must be either INGREDIENT or EQUIPMENT',
      });
      return;
    }

    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    const material = await materialsService.createMaterial({
      name,
      code,
      type,
      createdByUserId: req.user.userId,
    });

    res.status(201).json({
      success: true,
      message: 'Material created successfully',
      data: material,
    });
  } catch (error) {
    next(error);
  }
};

export const updateMaterial = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;
    const materialId = parseInt(id, 10);

    if (isNaN(materialId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid material ID',
      });
      return;
    }

    const { name, code, type } = req.body;

    if (type && !['INGREDIENT', 'EQUIPMENT'].includes(type)) {
      res.status(400).json({
        success: false,
        message: 'Type must be either INGREDIENT or EQUIPMENT',
      });
      return;
    }

    const material = await materialsService.updateMaterial(materialId, {
      name,
      code,
      type,
    });

    res.status(200).json({
      success: true,
      message: 'Material updated successfully',
      data: material,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Material not found') {
      res.status(404).json({
        success: false,
        message: error.message,
      });
      return;
    }
    next(error);
  }
};

export const deleteMaterial = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;
    const materialId = parseInt(id, 10);

    if (isNaN(materialId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid material ID',
      });
      return;
    }

    await materialsService.deleteMaterial(materialId);

    res.status(200).json({
      success: true,
      message: 'Material deleted successfully',
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Material not found') {
        res.status(404).json({
          success: false,
          message: error.message,
        });
        return;
      }
      if (
        error.message.includes('Cannot delete material') ||
        error.message.includes('is used in')
      ) {
        res.status(400).json({
          success: false,
          message: error.message,
        });
        return;
      }
    }
    next(error);
  }
};

export const getMaterialByCode = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { code } = req.params;

    const material = await materialsService.getMaterialByCode(code);

    if (!material) {
      res.status(404).json({
        success: false,
        message: 'Material not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: material,
    });
  } catch (error) {
    next(error);
  }
};

export const getIngredients = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const ingredients = await materialsService.getIngredients();

    res.status(200).json({
      success: true,
      data: ingredients,
      count: ingredients.length,
    });
  } catch (error) {
    next(error);
  }
};

export const getEquipment = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const equipment = await materialsService.getEquipment();

    res.status(200).json({
      success: true,
      data: equipment,
      count: equipment.length,
    });
  } catch (error) {
    next(error);
  }
};
