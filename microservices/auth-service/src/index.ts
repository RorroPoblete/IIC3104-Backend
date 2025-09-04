import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { authRoutes } from './routes/auth';

// Cargar variables de entorno
dotenv.config();

const app = express();
const PORT = process.env.AUTH_SERVICE_PORT || 3001;

// Middleware de seguridad y logging
app.use(helmet());
app.use(cors());
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rutas
app.use('/auth', authRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Servicio de autenticación funcionando correctamente',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'auth-service'
  });
});

// Middleware de manejo de errores
app.use(errorHandler);

// Iniciar servidor
app.listen(PORT, () => {
  logger.info(`🔐 Servicio de autenticación ejecutándose en el puerto ${PORT}`);
  logger.info(`📊 Entorno: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
