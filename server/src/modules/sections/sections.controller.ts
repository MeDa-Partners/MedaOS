import { Request, Response, NextFunction } from 'express';
import { sectionsService } from './sections.service';
import {
  createSectionSchema,
  updateSectionSchema,
  updateSectionStatusSchema,
} from './sections.validation';
import { sendSuccess } from '../../utils/response';
import { getRouteParam, cleanUuidParam } from '../../utils/params';

export class SectionsController {
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
      const onlyActive = req.query.onlyActive === 'true';

      const sections = await sectionsService.listSections(
        { departmentId, ventureId, onlyActive },
        this.getRequester(req)
      );
      sendSuccess(res, sections);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = getRouteParam(req.params.id);
      const section = await sectionsService.getSectionById(id, this.getRequester(req));
      sendSuccess(res, section);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = createSectionSchema.parse(req.body);
      const section = await sectionsService.createSection(validated, this.getRequester(req));
      sendSuccess(res, section, 201, 'Section created successfully');
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = getRouteParam(req.params.id);
      const validated = updateSectionSchema.parse(req.body);
      const section = await sectionsService.updateSection(id, validated, this.getRequester(req));
      sendSuccess(res, section, 200, 'Section updated successfully');
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = getRouteParam(req.params.id);
      const { status } = updateSectionStatusSchema.parse(req.body);
      const section = await sectionsService.updateSectionStatus(id, status, this.getRequester(req));
      sendSuccess(res, section, 200, `Section ${status === 'active' ? 'enabled' : 'disabled'} successfully`);
    } catch (error) {
      next(error);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = getRouteParam(req.params.id);
      await sectionsService.deleteSection(id, this.getRequester(req));
      sendSuccess(res, null, 200, 'Section deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  async accessCheck(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ventureParam =
        (req.query.ventureSlug as string) ||
        (req.query.ventureId as string) ||
        (req.headers['x-venture-slug'] as string) ||
        (req.headers['x-venture-id'] as string) ||
        '';

      const sectionParam =
        (req.params.slug as string) ||
        (req.query.sectionSlug as string) ||
        (req.params.id as string) ||
        '';

      if (!sectionParam) {
        res.status(400).json({ success: false, error: { message: 'section slug is required' } });
        return;
      }

      const check = await sectionsService.checkAccess(
        ventureParam,
        sectionParam,
        req.user!.id,
        req.user!.isAdmin
      );

      if (!check.hasAccess) {
        res.status(403).json({
          success: false,
          data: {
            allowed: false,
            section: sectionParam,
            message: check.reason || 'Access denied',
          },
          error: { message: check.reason || 'Access denied' },
        });
        return;
      }

      sendSuccess(res, {
        allowed: true,
        section: check.section?.slug || sectionParam,
        sectionDetail: check.section,
        message: 'Access granted',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const sectionsController = new SectionsController();
