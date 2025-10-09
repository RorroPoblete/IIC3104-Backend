import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

type LoadOptions = {
  optional?: boolean;
  disallowValues?: string[];
};

const candidateDirs = [
  process.cwd(),
  path.resolve(process.cwd(), '..'),
  path.resolve(process.cwd(), '../..'),
  path.resolve(__dirname, '..', '..'),
  path.resolve(__dirname, '..', '..', '..'),
];

const candidatePaths = candidateDirs
  .map((dir) => path.resolve(dir, '.env'))
  .filter((value, index, all) => all.indexOf(value) === index);

for (const envPath of candidatePaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    break;
  }
}

const NODE_ENV = process.env.NODE_ENV ?? 'development';

function loadEnvVar(name: string, options: LoadOptions = {}): string {
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

function parsePort(value: string, name: string): number {
  const port = Number.parseInt(value, 10);
  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`[env] ${name} must be a positive integer`);
  }
  return port;
}

function parseOrigins(raw: string): string[] {
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export const env = {
  nodeEnv: NODE_ENV,
  isProduction: NODE_ENV === 'production',
  appPort: parsePort(loadEnvVar('PORT', { optional: true }) || '3000', 'PORT'),
  corsOrigins: parseOrigins(loadEnvVar('CORS_ORIGIN', { optional: true }) || ''),
  databaseUrl: loadEnvVar('DATABASE_URL'),
  redisUrl: loadEnvVar('REDIS_URL', { optional: true }),
  uploadPath: loadEnvVar('UPLOAD_PATH', { optional: true }) || '/tmp/uploads',
  maxFileSize: Number.parseInt(loadEnvVar('MAX_FILE_SIZE', { optional: true }) || '10485760', 10),
  auth0Domain: loadEnvVar('AUTH0_DOMAIN', {
    optional: true,
    disallowValues: ['YOUR_AUTH0_DOMAIN', 'dev-xxxxx.us.auth0.com'],
  }),
  auth0Audience: loadEnvVar('AUTH0_AUDIENCE', {
    optional: true,
    disallowValues: ['YOUR_AUTH0_AUDIENCE', 'https://your-api/'],
  }),
  auth0ClientId: loadEnvVar('AUTH0_CLIENT_ID', {
    optional: true,
    disallowValues: ['YOUR_AUTH0_CLIENT_ID', 'TU_CLIENT_ID_DE_AUTH0'],
  }),
  logLevel: loadEnvVar('LOG_LEVEL', { optional: true }) || 'info',
};

export type AppEnv = typeof env;
