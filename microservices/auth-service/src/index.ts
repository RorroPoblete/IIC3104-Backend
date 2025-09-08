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
      schemas: {
        LoginBody: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                email: { type: 'string' },
                role: { type: 'string', enum: ['Admin'] },
              },
            },
          },
        },
      },
    },
    paths: {
      '/api/auth/login': {
        post: {
          summary: 'Login de administrador',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginBody' } } },
          },
          responses: {
            '200': { description: 'OK', content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginResponse' } } } },
            '400': { description: 'Entrada inválida' },
            '401': { description: 'Credenciales inválidas' },
            '423': { description: 'Cuenta inactiva' },
          },
        },
      },
      '/api/admin/ping': {
        get: {
          summary: 'Ping Admin (protegido)',
          security: [{ bearerAuth: [] }],
          responses: { '200': { description: 'OK' }, '401': { description: 'No autorizado' }, '403': { description: 'Prohibido' } },
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
