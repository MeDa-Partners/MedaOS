import { Request, Response, NextFunction } from 'express';
import { usersService } from './users.service';
import {
  createUserSchema,
  updateUserSchema,
  updateStatusSchema,
  assignTeamSchema,
  assignSectionsSchema,
  resetPasswordSchema,
} from './users.validation';
import { sendSuccess } from '../../utils/response';
import { getRouteParam } from '../../utils/params';

export class UsersController {
  private getRequester(req: Request) {
    return {
      id: req.user!.id,
      isAdmin: req.user!.isAdmin,
    };
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const search = req.query.search as string | undefined;
      const ventureId = req.query.ventureId as string | undefined;
      const teamId = req.query.teamId as string | undefined;

      const result = await usersService.listUsers(
        { page, limit, search, ventureId, teamId },
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

  async updateStatus(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = getRouteParam(req.params.id);
      const validatedInput = updateStatusSchema.parse(req.body);
      const user = await usersService.updateStatus(id, validatedInput, this.getRequester(req));
      sendSuccess(res, user, 200, 'Employee status updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async assignTeam(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = getRouteParam(req.params.id);
      const validatedInput = assignTeamSchema.parse(req.body);
      const user = await usersService.assignTeam(id, validatedInput, this.getRequester(req));
      sendSuccess(res, user, 200, 'Venture team assigned successfully');
    } catch (error) {
      next(error);
    }
  }

  async removeVenture(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = getRouteParam(req.params.id);
      const ventureId = getRouteParam(req.params.ventureId);
      const user = await usersService.removeVentureAssignment(
        id,
        ventureId,
        this.getRequester(req)
      );
      sendSuccess(res, user, 200, 'Employee removed from venture');
    } catch (error) {
      next(error);
    }
  }

  async assignSections(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = getRouteParam(req.params.id);
      const validatedInput = assignSectionsSchema.parse(req.body);
      const user = await usersService.assignSections(id, validatedInput, this.getRequester(req));
      sendSuccess(res, user, 200, 'Venture sections assigned successfully');
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = getRouteParam(req.params.id);
      const validatedInput = resetPasswordSchema.parse(req.body);
      await usersService.resetPassword(id, validatedInput, this.getRequester(req));
      sendSuccess(res, null, 200, 'Password reset successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const usersController = new UsersController();
