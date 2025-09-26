import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Carga .env desde varias ubicaciones: microservicio y raíz de IIC3104-Backend
const candidatePaths = [
  // .env en el cwd del proceso (normalmente el microservicio)
  path.resolve(process.cwd(), '.env'),
  // .env en ../ (microservices) y ../../ (IIC3104-Backend) respecto al cwd
  path.resolve(process.cwd(), '../.env'),
  path.resolve(process.cwd(), '../../.env'),
  // .env al nivel del microservicio
  path.resolve(__dirname, '../../../.env'), // .../auth-service/.env (cuando __dirname apunta a src/utils o dist/utils)
  // .env en la raíz de IIC3104-Backend (4 niveles arriba desde src/utils o dist/utils)
  path.resolve(__dirname, '../../../../.env'), // .../IIC3104-Backend/.env
  path.resolve(__dirname, '../../../../../.env'), // fallback cuando estructura varía entre src/dist
];
for (const p of candidatePaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    break;
  }
}

export const env = {
  port: parseInt(process.env.AUTH_SERVICE_PORT || '3001', 10),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/healthdb',
  auth0Domain: process.env.AUTH0_DOMAIN || '',
  auth0Audience: process.env.AUTH0_AUDIENCE || '',
  auth0ClientId: process.env.AUTH0_CLIENT_ID || '',
};

