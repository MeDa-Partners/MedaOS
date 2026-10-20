import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ordersService } from './orders.service';
import { workflowService } from './workflow.service';
import { getShiftsOverview, saveShifts } from './shifts.service';
import {
  bulkReassignSchema,
  followUpUpdateSchema,
  listOrdersQuerySchema,
  portalUpdateSchema,
  reassignSchema,
  saveShiftsSchema,
  verificationUpdateSchema,
} from './orders.validation';
import { sendSuccess } from '../../utils/response';
import { getRouteParam } from '../../utils/params';
import { BadRequestError } from '../../utils/errors';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const actorOf = (req: Request) => ({ id: req.user!.id, isAdmin: req.user!.isAdmin });

function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) throw new BadRequestError('Validation failed', result.error.flatten().fieldErrors);
  return result.data;
}

function orderId(req: Request): string {
  const id = getRouteParam(req.params.id);
  if (!UUID_RE.test(id)) throw new BadRequestError('Invalid order id');
  return id;
}

type Handler = (req: Request, res: Response) => Promise<void>;
const wrap = (fn: Handler) => (req: Request, res: Response, next: NextFunction) => fn(req, res).catch(next);

/** After a change, answer with the order as the caller now sees it (fields, timeline, capabilities). */
const respondWithOrder = async (req: Request, res: Response, id: string) =>
  void sendSuccess(res, await ordersService.get(req.ventureId!, id, actorOf(req)));

export const ordersController = {
  list: wrap(async (req, res) => {
    sendSuccess(res, await ordersService.list(req.ventureId!, req.user!.id, parse(listOrdersQuerySchema, req.query)));
  }),

  get: wrap(async (req, res) => respondWithOrder(req, res, orderId(req))),

  updateVerification: wrap(async (req, res) => {
    const id = orderId(req);
    await workflowService.updateVerification(req.ventureId!, id, actorOf(req), parse(verificationUpdateSchema, req.body));
    await respondWithOrder(req, res, id);
  }),

  updatePortal: wrap(async (req, res) => {
    const id = orderId(req);
    await workflowService.updatePortal(req.ventureId!, id, actorOf(req), parse(portalUpdateSchema, req.body));
    await respondWithOrder(req, res, id);
  }),

  updateFollowUp: wrap(async (req, res) => {
    const id = orderId(req);
    await workflowService.updateFollowUp(req.ventureId!, id, actorOf(req), parse(followUpUpdateSchema, req.body));
    await respondWithOrder(req, res, id);
  }),

  reassign: wrap(async (req, res) => {
    const id = orderId(req);
    await workflowService.reassign(req.ventureId!, id, actorOf(req), parse(reassignSchema, req.body));
    await respondWithOrder(req, res, id);
  }),

  bulkReassign: wrap(async (req, res) => {
    sendSuccess(res, await workflowService.bulkReassign(req.ventureId!, actorOf(req), parse(bulkReassignSchema, req.body)));
  }),

  getShifts: wrap(async (req, res) => {
    sendSuccess(res, await getShiftsOverview(req.ventureId!, actorOf(req)));
  }),

  saveShifts: wrap(async (req, res) => {
    sendSuccess(res, await saveShifts(req.ventureId!, actorOf(req), parse(saveShiftsSchema, req.body)));
  }),
};
