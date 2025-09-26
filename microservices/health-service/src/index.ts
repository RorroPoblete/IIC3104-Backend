import express from 'express';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import Redis from 'ioredis';
import swaggerUi from 'swagger-ui-express';
import swaggerJSDoc from 'swagger-jsdoc';

dotenv.config();

const requireEnv = (name: string) => {
  const value = (process.env[name] ?? '').trim();
  if (!value) {
    throw new Error(`[env] Missing required environment variable ${name}`);
  }
  return value;
};

const app = express();
const PORT_VALUE = requireEnv('PORT');
const PORT = Number.parseInt(PORT_VALUE, 10);
if (Number.isNaN(PORT) || PORT <= 0) {
  throw new Error('[env] PORT must be a positive integer');
}

// Swagger setup
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Health Service API',
      version: '1.0.0',
      description: 'API mínima para health check con PostgreSQL y Redis',
    },
    servers: [
      { url: `http://localhost:${PORT}` }
    ]
  },
  apis: ['./src/index.ts'],
};
const swaggerSpec = swaggerJSDoc(swaggerOptions);
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/docs.json', (_req, res) => res.json(swaggerSpec));

// PostgreSQL (datos maestros e histórico)
const databaseUrl = requireEnv('DATABASE_URL');
const pgPool = new Pool({ connectionString: databaseUrl });

// Redis (caché de validaciones)
const redisUrl = requireEnv('REDIS_URL');
const redis = new Redis(redisUrl);

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health check básico
 *     description: Retorna "Hello World" y verifica conexiones a PostgreSQL y Redis.
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Hello World
 *                 postgresNow:
 *                   type: string
 *                   example: 2025-01-01T00:00:00.000Z
 *                 redisPing:
 *                   type: string
 *                   example: pong
 *       500:
 *         description: Error en verificación
 */
app.get('/health', async (_req, res) => {
  try {
    const { rows } = await pgPool.query('SELECT NOW() as now');
    await redis.set('health:ping', 'pong', 'EX', 5);
    const redisPing = await redis.get('health:ping');

    res.json({
      message: 'Hello World',
      postgresNow: rows[0]?.now,
      redisPing,
    });
  } catch (err: any) {
    res.status(500).json({ message: 'Health check failed', error: err?.message || 'unknown' });
  }
});

app.listen(PORT, () => {
  console.log(`Health service listening on port ${PORT}`);
  console.log(`Swagger UI: http://localhost:${PORT}/docs`);
});
