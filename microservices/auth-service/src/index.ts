import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import router from './routes/auth';
import { env } from './utils/env';
import swaggerUi from 'swagger-ui-express';
import swaggerJSDoc from 'swagger-jsdoc';

const app = express();

app.use(helmet());
app.use(cors({ origin: env.corsOrigin }));
app.use(morgan('dev'));
app.use(express.json());

// Auth + Admin routes
app.use(router);

// Health
app.get('/health', (_req, res) => {
  res.json({ success: true, service: 'auth-service' });
});

// Root helper
app.get('/', (_req, res) => {
  res.json({ ok: true, service: 'auth-service' });
});

// Config pública para el frontend (no incluye secretos)
app.get('/public/config', (_req, res) => {
  res.json({
    auth0Domain: env.auth0Domain,
    auth0Audience: env.auth0Audience,
    auth0ClientId: env.auth0ClientId,
  });
});

// Swagger UI (OpenAPI)
const swaggerSpec = swaggerJSDoc({
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Auth Service API',
      version: '1.0.0',
      description: 'Endpoints de autenticación y rutas protegidas',
    },
    servers: [{ url: `http://localhost:${env.port}` }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {},
    },
    paths: {
      '/api/admin/ping': {
        get: {
          summary: 'Ping Admin (protegido)',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'OK' }, '401': { description: 'No autorizado' }, '403': { description: 'Prohibido' } },
        },
      },
      '/api/me': {
        get: {
          summary: 'Obtener claims del token (protegido)',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'OK' }, '401': { description: 'No autorizado' } },
        },
      },
    },
  },
  apis: [],
});
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

if (process.env.NODE_ENV !== 'test') {
  app.listen(env.port, '0.0.0.0', () => {
    console.log(`Auth service listening on 0.0.0.0:${env.port}`);
  });
}

export default app;
