import { Request, Response, NextFunction } from 'express';
import { sectionsService } from './sections.service';
import { sendSuccess } from '../../utils/response';
import { getRouteParam, cleanUuidParam } from '../../utils/params';
import { BadRequestError } from '../../utils/errors';

const actorOf = (req: Request) => ({ id: req.user!.id, isAdmin: req.user!.isAdmin });

export const sectionsController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await sectionsService.listSections(
        {
          departmentId: cleanUuidParam(req.query.departmentId),
          ventureId: cleanUuidParam(req.query.ventureId),
        },
        actorOf(req)
      );
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, await sectionsService.getSection(getRouteParam(req.params.id), actorOf(req)));
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /sections/:slug/access-check?ventureId=<id|slug>
   * Always 200; `allowed` + `reason` tell the UI what to render.
   */
  async accessCheck(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sectionSlug = getRouteParam(req.params.slug);
      const ventureIdentifier =
        (typeof req.query.ventureId === 'string' && req.query.ventureId.trim()) || req.ventureId;
      if (!ventureIdentifier) {
        throw new BadRequestError('ventureId is required');
      }
      sendSuccess(res, await sectionsService.checkAccess(actorOf(req), ventureIdentifier, sectionSlug));
    } catch (error) {
      next(error);
    }
  },
};
