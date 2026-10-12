import { Request, Response, NextFunction } from 'express';
import { teamsService } from './teams.service';
import { createTeamSchema, updateTeamSchema, assignTeamHeadSchema } from './teams.validation';
import { sendSuccess } from '../../utils/response';
import { getRouteParam, cleanUuidParam } from '../../utils/params';

export class TeamsController {
  private getRequester(req: Request) {
    return {
      id: req.user!.id,
      isAdmin: req.user!.isAdmin,
    };
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const departmentId = cleanUuidParam(req.query.departmentId);
      const ventureId = cleanUuidParam(req.query.ventureId);
      const teams = await teamsService.listTeams(
        { departmentId, ventureId },
        this.getRequester(req)
      );
      sendSuccess(res, teams);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = getRouteParam(req.params.id);
      const team = await teamsService.getTeamById(id, this.getRequester(req));
      sendSuccess(res, team);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = createTeamSchema.parse(req.body);
      const team = await teamsService.createTeam(validated, this.getRequester(req));
      sendSuccess(res, team, 201, 'Team created successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = getRouteParam(req.params.id);
      const validated = updateTeamSchema.parse(req.body);
      const team = await teamsService.updateTeam(id, validated, this.getRequester(req));
      sendSuccess(res, team, 200, 'Team updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async assignHead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = getRouteParam(req.params.id);
      const { headUserId } = assignTeamHeadSchema.parse(req.body);
      const team = await teamsService.assignHead(id, headUserId, this.getRequester(req));
      sendSuccess(res, team, 200, 'Team Head assigned successfully');
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = getRouteParam(req.params.id);
      await teamsService.deleteTeam(id, this.getRequester(req));
      sendSuccess(res, null, 200, 'Team deleted successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const teamsController = new TeamsController();
