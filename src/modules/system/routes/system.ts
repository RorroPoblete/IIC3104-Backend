import { Router, Request, Response } from 'express';
import { pgPool } from '../../../shared/clients/postgres';
import { redisClient } from '../../../shared/clients/redis';
import { env } from '../../../config/env';

const router = Router();

router.get('/health', async (_req: Request, res: Response) => {
  try {
    const { rows } = await pgPool.query<{ now: Date }>('SELECT NOW() as now');
    const now = rows[0]?.now ?? null;

    let redisPing: string | null = null;
    if (redisClient?.isOpen) {
      redisPing = await redisClient.ping();
    }

    res.json({
      message: 'Hello World',
      postgresNow: now,
      redisPing,
    });
  } catch (error: unknown) {
    res.status(500).json({
      message: 'Health check failed',
      error: error instanceof Error ? error.message : 'unknown',
    });
  }
});

router.get('/public/config', (_req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store');
  res.json({
    auth0Domain: env.auth0Domain ?? '',
    auth0Audience: env.auth0Audience ?? '',
    auth0ClientId: env.auth0ClientId ?? '',
  });
});

export const systemRouter = router;
