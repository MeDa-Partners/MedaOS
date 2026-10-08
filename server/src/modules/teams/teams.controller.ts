import { Request, Response, NextFunction } from 'express';
import { teamsService } from './teams.service';
import {
  createTeamSchema,
  updateTeamSchema,
} from './teams.validation';
import { sendSuccess } from '../../utils/response';
import { getRouteParam } from '../../utils/params';

export class TeamsController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ventureId = typeof req.query.ventureId === 'string' ? req.query.ventureId : undefined;
      const teamsList = await teamsService.listTeams(ventureId);
      sendSuccess(res, teamsList);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = getRouteParam(req.params.id);
      const team = await teamsService.getTeamById(id);
      sendSuccess(res, team);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedInput = createTeamSchema.parse(req.body);
      const team = await teamsService.createTeam(validatedInput);
      sendSuccess(res, team, 201, 'Team created successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = getRouteParam(req.params.id);
      const validatedInput = updateTeamSchema.parse(req.body);
      const team = await teamsService.updateTeam(id, validatedInput);
      sendSuccess(res, team, 200, 'Team updated successfully');
    } catch (error) {
      next(error);
    }
  }
}

export const teamsController = new TeamsController();
