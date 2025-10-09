import { createClient } from 'redis';
import { env } from '../../config/env';
import { logger } from '../utils/logger';

const redisUrl = env.redisUrl;

type RedisClient = ReturnType<typeof createClient>;

let client: RedisClient | null = null;

if (redisUrl) {
  const redisInstance = createClient({
    url: redisUrl,
    socket: {
      reconnectStrategy: () => false,
    },
  });

  redisInstance.on('error', (error: unknown) => {
    logger.warn('Error en Redis, se deshabilita la conexión', { error });
  });

  void redisInstance.connect().catch((error: unknown) => {
    logger.warn('No se pudo establecer conexión con Redis durante el arranque', { error });
  });

  client = redisInstance;
} else {
  logger.info('Redis deshabilitado: no se configuró REDIS_URL');
}

export const redisClient = client;
