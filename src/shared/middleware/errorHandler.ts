import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (error: AppError, req: Request, res: Response, _next: NextFunction) => {
  const statusCode = error.statusCode ?? 500;
  const message = error.message ?? 'Error interno del servidor';

  logger.error('Unhandled error', {
    error: message,
    stack: error.stack,
    statusCode,
    method: req.method,
    url: req.originalUrl,
  });

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
  });
};

export const asyncHandler =
  <T extends (...args: any[]) => Promise<any>>(handler: T) =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(handler(req, res, next)).catch(next);
