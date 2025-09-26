import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import importRoutes from './routes/import';
import { env } from './utils/env';

dotenv.config();

const app = express();
const allowedOrigins = env.corsOrigins;

app.use(helmet());
app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : true,
    credentials: true,
  }),
);
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/import', importRoutes);

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Servicio de codificación funcionando correctamente',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'codification-service',
  });
});

app.use(errorHandler);

app.listen(env.port, () => {
  logger.info(`Servicio de codificación escuchando en ${env.port}`);
  logger.info(`Entorno: ${env.nodeEnv}`);
  logger.info(`Directorio de uploads: ${env.uploadPath}`);
});

export default app;
