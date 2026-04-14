import { NewsDataError } from '../services/newsDataService.js';
import type { NextFunction, Request, Response } from 'express';

export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof NewsDataError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      ...(process.env.NODE_ENV === 'development' ? { raw: err.raw } : {}),
    });
  }

  if (err && typeof err === 'object' && 'statusCode' in err) {
    const typedErr = err as { statusCode?: number; message?: string };
    return res.status(typedErr.statusCode ?? 500).json({
      success: false,
      error: typedErr.message ?? 'Request failed',
    });
  }

  const message = err instanceof Error ? err.message : 'Internal server error';
  if (err instanceof Error) {
    console.error('[Unhandled error]', err);
  }

  return res.status(500).json({
    success: false,
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && err instanceof Error ? { stack: err.stack } : {}),
  });
};
