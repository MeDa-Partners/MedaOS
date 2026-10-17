import { Request, Response, NextFunction } from 'express';
import { usersService } from './users.service';
import {
  createUserSchema,
  listUsersQuerySchema,
  resetPasswordSchema,
  setMembershipSchema,
  setSectionsSchema,
  updateStatusSchema,
  updateUserSchema,
} from './users.validation';
import { sendSuccess } from '../../utils/response';
import { cleanUuidParam, getRouteParam } from '../../utils/params';

type Handler = (req: Request, res: Response) => Promise<void>;

/** Wraps a handler so thrown errors reach the central error handler. */
const handle =
  (fn: Handler) =>
  (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res).catch(next);
  };

const actorOf = (req: Request) => ({ id: req.user!.id, isAdmin: req.user!.isAdmin });
const idOf = (req: Request) => getRouteParam(req.params.id);

export const usersController = {
  list: handle(async (req, res) => {
    const query = listUsersQuerySchema.parse({
      ...req.query,
      ventureId: cleanUuidParam(req.query.ventureId),
      departmentId: cleanUuidParam(req.query.departmentId),
      teamId: cleanUuidParam(req.query.teamId),
    });
    sendSuccess(res, await usersService.listUsers(query, actorOf(req)));
  }),

  getById: handle(async (req, res) => {
    sendSuccess(res, await usersService.getUser(idOf(req), actorOf(req)));
  }),

  create: handle(async (req, res) => {
    const input = createUserSchema.parse(req.body);
    sendSuccess(res, await usersService.createUser(input, actorOf(req)), 201, 'Employee created');
  }),

  update: handle(async (req, res) => {
    const input = updateUserSchema.parse(req.body);
    sendSuccess(res, await usersService.updateUser(idOf(req), input, actorOf(req)), 200, 'Employee updated');
  }),

  updateStatus: handle(async (req, res) => {
    const input = updateStatusSchema.parse(req.body);
    sendSuccess(res, await usersService.updateStatus(idOf(req), input, actorOf(req)), 200, 'Status updated');
  }),

  resetPassword: handle(async (req, res) => {
    const { newPassword } = resetPasswordSchema.parse(req.body);
    await usersService.resetPassword(idOf(req), newPassword, actorOf(req));
    sendSuccess(res, null, 200, 'Password reset. The employee has been signed out everywhere.');
  }),

  setMembership: handle(async (req, res) => {
    const input = setMembershipSchema.parse(req.body);
    sendSuccess(res, await usersService.setMembership(idOf(req), input, actorOf(req)), 200, 'Placement updated');
  }),

  removeMembership: handle(async (req, res) => {
    const ventureId = getRouteParam(req.params.ventureId);
    sendSuccess(res, await usersService.removeMembership(idOf(req), ventureId, actorOf(req)), 200, 'Removed from venture');
  }),

  setSections: handle(async (req, res) => {
    const input = setSectionsSchema.parse(req.body);
    sendSuccess(res, await usersService.setSections(idOf(req), input, actorOf(req)), 200, 'Section access updated');
  }),

  grantSection: handle(async (req, res) => {
    const sectionId = getRouteParam(req.params.sectionId);
    sendSuccess(res, await usersService.grantSection(idOf(req), sectionId, actorOf(req)), 200, 'Access granted');
  }),

  revokeSection: handle(async (req, res) => {
    const sectionId = getRouteParam(req.params.sectionId);
    sendSuccess(res, await usersService.revokeSection(idOf(req), sectionId, actorOf(req)), 200, 'Access revoked');
  }),
};
