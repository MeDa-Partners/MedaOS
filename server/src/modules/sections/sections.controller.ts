import { Request, Response, NextFunction } from 'express';
import { sectionsService } from './sections.service';
import {
  createSectionSchema,
  updateSectionSchema,
} from './sections.validation';
import { sendSuccess } from '../../utils/response';
import { getRouteParam } from '../../utils/params';

export class SectionsController {
  async list(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sections = await sectionsService.listSections();
      sendSuccess(res, sections);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = getRouteParam(req.params.id);
      const section = await sectionsService.getSectionById(id);
      sendSuccess(res, section);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedInput = createSectionSchema.parse(req.body);
      const section = await sectionsService.createSection(validatedInput);
      sendSuccess(res, section, 201, 'Section created successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = getRouteParam(req.params.id);
      const validatedInput = updateSectionSchema.parse(req.body);
      const section = await sectionsService.updateSection(id, validatedInput);
      sendSuccess(res, section, 200, 'Section updated successfully');
    } catch (error) {
      next(error);
    }
  }

  accessCheck(sectionSlug: string) {
    return (req: Request, res: Response): void => {
      sendSuccess(
        res,
        {
          allowed: true,
          section: sectionSlug,
          userId: req.user?.id,
          ventureId: req.ventureId,
          message: `Authorized to access ${sectionSlug} section`,
        },
        200
      );
    };
  }
}

export const sectionsController = new SectionsController();
