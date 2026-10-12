import { Request, Response, NextFunction } from 'express';
import { usersService } from './users.service';
import {
  createUserSchema,
  updateUserSchema,
  updateStatusSchema,
  assignMembershipSchema,
  assignSectionsSchema,
  resetPasswordSchema,
} from './users.validation';
import { sendSuccess } from '../../utils/response';
import { getRouteParam, cleanUuidParam } from '../../utils/params';

export class UsersController {
  private getRequester(req: Request) {
    return {
      id: req.user!.id,
      isAdmin: req.user!.isAdmin,
    };
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const search = req.query.search as string | undefined;
      const ventureId = cleanUuidParam(req.query.ventureId);
      const departmentId = cleanUuidParam(req.query.departmentId);
      const teamId = cleanUuidParam(req.query.teamId);

      const result = await usersService.listUsers(
        { page, limit, search, ventureId, departmentId, teamId },
        this.getRequester(req)
      );
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = getRouteParam(req.params.id);
      const user = await usersService.getUserById(id, this.getRequester(req));
      sendSuccess(res, user);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedInput = createUserSchema.parse(req.body);
      const user = await usersService.createUser(validatedInput, this.getRequester(req));
      sendSuccess(res, user, 201, 'Employee created successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = getRouteParam(req.params.id);
      const validatedInput = updateUserSchema.parse(req.body);
      const user = await usersService.updateUser(id, validatedInput, this.getRequester(req));
      sendSuccess(res, user, 200, 'Employee updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = getRouteParam(req.params.id);
      const validatedInput = updateStatusSchema.parse(req.body);
      const user = await usersService.updateStatus(id, validatedInput, this.getRequester(req));
      sendSuccess(res, user, 200, 'Employee status updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async assignMembership(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = getRouteParam(req.params.id);
      const validatedInput = assignMembershipSchema.parse(req.body);
      const user = await usersService.assignMembership(id, validatedInput, this.getRequester(req));
      sendSuccess(res, user, 200, 'Organizational membership assigned successfully');
    } catch (error) {
      next(error);
    }
  }

  async removeMembership(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = getRouteParam(req.params.id);
      const ventureId = getRouteParam(req.params.ventureId);
      const user = await usersService.removeMembership(id, ventureId, this.getRequester(req));
      sendSuccess(res, user, 200, 'Removed from venture successfully');
    } catch (error) {
      next(error);
    }
  }

  async assignSections(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = getRouteParam(req.params.id);
      const validatedInput = assignSectionsSchema.parse(req.body);
      const user = await usersService.assignSections(id, validatedInput, this.getRequester(req));
      sendSuccess(res, user, 200, 'Section access assigned successfully');
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = getRouteParam(req.params.id);
      const validatedInput = resetPasswordSchema.parse(req.body);
      await usersService.resetPassword(id, validatedInput.newPassword, this.getRequester(req));
      sendSuccess(res, null, 200, 'Password reset successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const usersController = new UsersController();
