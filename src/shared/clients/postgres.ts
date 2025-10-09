import { Pool } from 'pg';
import { env } from '../../config/env';
import { logger } from '../utils/logger';

export const pgPool = new Pool({
  connectionString: env.databaseUrl,
});

pgPool.on('error', (error: unknown) => {
  logger.error('Error inesperado en la conexión de PostgreSQL', { error });
});
