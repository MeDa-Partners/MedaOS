import { Request, Response, NextFunction } from 'express';
import { departmentsService } from './departments.service';
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  assignDepartmentHeadSchema,
} from './departments.validation';
import { sendSuccess } from '../../utils/response';
import { getRouteParam, cleanUuidParam } from '../../utils/params';

export class DepartmentsController {
  private getRequester(req: Request) {
    return {
      id: req.user!.id,
      isAdmin: req.user!.isAdmin,
    };
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ventureId = cleanUuidParam(req.query.ventureId);
      const departments = await departmentsService.listDepartments(
        { ventureId },
        this.getRequester(req)
      );
      sendSuccess(res, departments);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = getRouteParam(req.params.id);
      const department = await departmentsService.getDepartmentById(id, this.getRequester(req));
      sendSuccess(res, department);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = createDepartmentSchema.parse(req.body);
      const department = await departmentsService.createDepartment(validated, this.getRequester(req));
      sendSuccess(res, department, 201, 'Department created successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = getRouteParam(req.params.id);
      const validated = updateDepartmentSchema.parse(req.body);
      const department = await departmentsService.updateDepartment(id, validated, this.getRequester(req));
      sendSuccess(res, department, 200, 'Department updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async assignHead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = getRouteParam(req.params.id);
      const { headUserId } = assignDepartmentHeadSchema.parse(req.body);
      const department = await departmentsService.assignHead(id, headUserId, this.getRequester(req));
      sendSuccess(res, department, 200, 'Department Head assigned successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = getRouteParam(req.params.id);
      await departmentsService.deleteDepartment(id, this.getRequester(req));
      sendSuccess(res, null, 200, 'Department deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const departmentsController = new DepartmentsController();
