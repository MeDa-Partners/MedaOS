import { Request, Response, NextFunction } from 'express';
import { departmentsService } from './departments.service';
import { assignDepartmentHeadSchema } from './departments.validation';
import { sendSuccess } from '../../utils/response';
import { getRouteParam, cleanUuidParam } from '../../utils/params';

const actorOf = (req: Request) => ({ id: req.user!.id, isAdmin: req.user!.isAdmin });

export const departmentsController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ventureId = cleanUuidParam(req.query.ventureId);
      sendSuccess(res, await departmentsService.listDepartments({ ventureId }, actorOf(req)));
    } catch (error) {
      next(error);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, await departmentsService.getDepartment(getRouteParam(req.params.id), actorOf(req)));
    } catch (error) {
      next(error);
    }
  },

  async assignHead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { headUserId } = assignDepartmentHeadSchema.parse(req.body);
      const dept = await departmentsService.assignHead(getRouteParam(req.params.id), headUserId, actorOf(req));
      sendSuccess(res, dept, 200, headUserId ? 'Department head appointed' : 'Department head removed');
    } catch (error) {
      next(error);
    }
  },
};
