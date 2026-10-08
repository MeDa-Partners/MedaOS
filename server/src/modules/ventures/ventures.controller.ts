import { Request, Response, NextFunction } from 'express';
import { venturesService } from './ventures.service';
import {
  createVentureSchema,
  updateVentureSchema,
  setVentureSectionsSchema,
} from './ventures.validation';
import { sendSuccess } from '../../utils/response';
import { getRouteParam } from '../../utils/params';

export class VenturesController {
  async list(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const venturesList = await venturesService.listVentures();
      sendSuccess(res, venturesList);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = getRouteParam(req.params.id);
      const venture = await venturesService.getVentureById(id);
      sendSuccess(res, venture);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedInput = createVentureSchema.parse(req.body);
      const venture = await venturesService.createVenture(validatedInput);
      sendSuccess(res, venture, 201, 'Venture created successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = getRouteParam(req.params.id);
      const validatedInput = updateVentureSchema.parse(req.body);
      const venture = await venturesService.updateVenture(id, validatedInput);
      sendSuccess(res, venture, 200, 'Venture updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async setSections(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = getRouteParam(req.params.id);
      const validatedInput = setVentureSectionsSchema.parse(req.body);
      const venture = await venturesService.setVentureSections(id, validatedInput.sectionIds);
      sendSuccess(res, venture, 200, 'Venture sections updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async testAccess(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const ventureId = getRouteParam(req.params.ventureId);
      sendSuccess(
        res,
        {
          allowed: true,
          userId: req.user?.id,
          ventureId,
          message: 'Authorized to access venture data',
        },
        200
      );
    } catch (error) {
      next(error);
    }
  }
}

export const venturesController = new VenturesController();
