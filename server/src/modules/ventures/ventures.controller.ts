import { Request, Response, NextFunction } from 'express';
import { venturesService } from './ventures.service';
import { createVentureSchema, updateVentureSchema } from './ventures.validation';
import { sendSuccess } from '../../utils/response';
import { getRouteParam } from '../../utils/params';

export class VenturesController {
  private getRequester(req: Request) {
    if (!req.user) return undefined;
    return {
      id: req.user.id,
      isAdmin: req.user.isAdmin,
    };
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const venturesList = await venturesService.listVentures(this.getRequester(req));
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

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = getRouteParam(req.params.id);
      await venturesService.deleteVenture(id);
      sendSuccess(res, null, 200, 'Venture deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const venturesController = new VenturesController();
