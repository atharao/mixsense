import { Request, Response, NextFunction } from 'express';
import { MaterialsService } from './materials.service';

const materialsService = new MaterialsService();

export const listMaterials = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const materials = await materialsService.getAllMaterials();

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
    const { name, code } = req.body;

    if (!name || !code) {
      res.status(400).json({
        success: false,
        message: 'Name and code are required',
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

    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    const { name, code } = req.body;

    const material = await materialsService.updateMaterial(materialId, {
      name,
      code,
      updatedByUserId: req.user.userId,
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

    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    await materialsService.deleteMaterial(materialId, req.user.userId);

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
