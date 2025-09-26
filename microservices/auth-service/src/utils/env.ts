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
  path.resolve(__dirname, '../../../.env'),
  // .env en la raíz de IIC3104-Backend (4 niveles arriba desde src/utils o dist/utils)
  path.resolve(__dirname, '../../../../.env'),
  path.resolve(__dirname, '../../../../../.env'),
];
for (const p of candidatePaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    break;
  }
}

const NODE_ENV = process.env.NODE_ENV ?? 'development';
const isProduction = NODE_ENV === 'production';

type LoadOptions = {
  optional?: boolean;
  disallowValues?: string[];
};

function loadEnvVar(name: string, options: LoadOptions = {}) {
  const raw = process.env[name];
  const value = (raw ?? '').trim();

  if (!value) {
    if (options.optional) {
      return value;
    }
    throw new Error(`[env] Missing required environment variable ${name}`);
  }

  if (options.disallowValues?.includes(value)) {
    throw new Error(`[env] Environment variable ${name} uses placeholder value "${value}"`);
  }

  return value;
}

const parsePort = (value: string, name: string) => {
  const port = Number.parseInt(value, 10);
  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`[env] ${name} must be a positive integer`);
  }
  return port;
};

export const env = {
  nodeEnv: NODE_ENV,
  isProduction,
  port: parsePort(loadEnvVar('AUTH_SERVICE_PORT'), 'AUTH_SERVICE_PORT'),
  corsOrigin: loadEnvVar('CORS_ORIGIN'),
  databaseUrl: loadEnvVar('DATABASE_URL'),
  auth0Domain: loadEnvVar('AUTH0_DOMAIN', {
    disallowValues: ['dev-xxxxx.us.auth0.com', 'YOUR_AUTH0_DOMAIN'],
  }),
  auth0Audience: loadEnvVar('AUTH0_AUDIENCE', {
    disallowValues: ['https://your-api/', 'YOUR_AUTH0_AUDIENCE'],
  }),
  auth0ClientId: loadEnvVar('AUTH0_CLIENT_ID', {
    disallowValues: ['TU_CLIENT_ID_DE_AUTH0', 'YOUR_AUTH0_CLIENT_ID'],
  }),
};
