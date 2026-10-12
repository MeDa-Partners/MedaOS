import { Request, Response, NextFunction } from 'express';
import { env } from '../../config/env';
import { devAuthService } from './dev-auth.service';
import { devService } from './dev.service';
import {
  devLoginSchema,
  devCreateVentureSchema,
  devUpdateVentureSchema,
  devCreateDepartmentSchema,
  devUpdateDepartmentSchema,
  devCreateSectionSchema,
  devUpdateSectionSchema,
} from './dev.validation';
import { sendSuccess } from '../../utils/response';
import { getRouteParam, cleanUuidParam } from '../../utils/params';
import { getSessionCookieOptions } from '../../utils/cookie';

export class DevController {
  // ===================== AUTH =====================

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { username, password } = devLoginSchema.parse(req.body);
      const token = await devAuthService.authenticateDeveloper(username, password);

      const maxAgeMs = env.DEV_SESSION_TTL_HOURS * 3600 * 1000;
      res.cookie(env.DEV_SESSION_COOKIE_NAME, token, getSessionCookieOptions(req, maxAgeMs));

      sendSuccess(
        res,
        {
          username: env.DEV_ADMIN_USERNAME,
          isDeveloper: true,
          expiresInHours: env.DEV_SESSION_TTL_HOURS,
        },
        200,
        'Developer session authenticated successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.clearCookie(env.DEV_SESSION_COOKIE_NAME, getSessionCookieOptions(req));
      sendSuccess(res, null, 200, 'Developer session ended successfully');
    } catch (error) {
      next(error);
    }
  }

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, {
        username: req.devUser?.username || env.DEV_ADMIN_USERNAME,
        isDeveloper: true,
      });
    } catch (error) {
      next(error);
    }
  }

  // ===================== REGISTRY & CATALOG =====================

  async getRegistry(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const registry = devService.getFeatureRegistry();
      sendSuccess(res, registry);
    } catch (error) {
      next(error);
    }
  }

  async getCatalogOverview(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const overview = await devService.getCatalogOverview();
      sendSuccess(res, overview);
    } catch (error) {
      next(error);
    }
  }

  // ===================== VENTURES =====================

  async listVentures(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const list = await devService.listVentures();
      sendSuccess(res, list);
    } catch (error) {
      next(error);
    }
  }

  async createVenture(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = devCreateVentureSchema.parse(req.body);
      const venture = await devService.createVenture(validated);
      sendSuccess(res, venture, 201, 'Venture registered in catalog');
    } catch (error) {
      next(error);
    }
  }

  async updateVenture(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = getRouteParam(req.params.id);
      const validated = devUpdateVentureSchema.parse(req.body);
      const venture = await devService.updateVenture(id, validated);
      sendSuccess(res, venture, 200, 'Venture metadata updated');
    } catch (error) {
      next(error);
    }
  }

  async deleteVenture(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = getRouteParam(req.params.id);
      const force = req.query.force === 'true';
      await devService.deleteVenture(id, force);
      sendSuccess(res, null, 200, 'Venture removed from catalog');
    } catch (error) {
      next(error);
    }
  }

  // ===================== DEPARTMENTS =====================

  async listDepartments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ventureId = cleanUuidParam(req.query.ventureId);
      const list = await devService.listDepartments(ventureId);
      sendSuccess(res, list);
    } catch (error) {
      next(error);
    }
  }

  async createDepartment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = devCreateDepartmentSchema.parse(req.body);
      const dept = await devService.createDepartment(validated);
      sendSuccess(res, dept, 201, 'Department registered in catalog');
    } catch (error) {
      next(error);
    }
  }

  async updateDepartment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = getRouteParam(req.params.id);
      const validated = devUpdateDepartmentSchema.parse(req.body);
      const dept = await devService.updateDepartment(id, validated);
      sendSuccess(res, dept, 200, 'Department metadata updated');
    } catch (error) {
      next(error);
    }
  }

  async deleteDepartment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = getRouteParam(req.params.id);
      const force = req.query.force === 'true';
      await devService.deleteDepartment(id, force);
      sendSuccess(res, null, 200, 'Department removed from catalog');
    } catch (error) {
      next(error);
    }
  }

  // ===================== SECTIONS =====================

  async listSections(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const departmentId = cleanUuidParam(req.query.departmentId);
      const ventureId = cleanUuidParam(req.query.ventureId);
      const list = await devService.listSections(departmentId, ventureId);
      sendSuccess(res, list);
    } catch (error) {
      next(error);
    }
  }

  async createSection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validated = devCreateSectionSchema.parse(req.body);
      const section = await devService.createSection(validated);
      sendSuccess(res, section, 201, 'Section registered in catalog');
    } catch (error) {
      next(error);
    }
  }

  async updateSection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = getRouteParam(req.params.id);
      const validated = devUpdateSectionSchema.parse(req.body);
      const section = await devService.updateSection(id, validated);
      sendSuccess(res, section, 200, 'Section metadata updated');
    } catch (error) {
      next(error);
    }
  }

  async deleteSection(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = getRouteParam(req.params.id);
      const force = req.query.force === 'true';
      await devService.deleteSection(id, force);
      sendSuccess(res, null, 200, 'Section removed from catalog');
    } catch (error) {
      next(error);
    }
  }
}

export const devController = new DevController();
