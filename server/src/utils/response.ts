import { Response } from 'express';

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode: number = 200,
  message?: string
): Response {
  return res.status(statusCode).json({
    success: true,
    ...(message && { message }),
    data,
  });
}

export function sendError(
  res: Response,
  statusCode: number,
  message: string,
  details?: unknown
): Response {
  return res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(details !== undefined && { details }),
    },
  });
}
