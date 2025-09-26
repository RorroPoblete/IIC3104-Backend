import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const envPaths = [
  process.cwd(),
  path.resolve(process.cwd(), '..'),
  path.resolve(process.cwd(), '../..'),
  path.resolve(__dirname, '../../../'),
  path.resolve(__dirname, '../../../../'),
  path.resolve(__dirname, '../../../../../'),
]
  .map((dir) => path.resolve(dir, '.env'))
  .filter((candidate, index, all) => all.indexOf(candidate) === index);

for (const candidate of envPaths) {
  if (fs.existsSync(candidate)) {
    dotenv.config({ path: candidate });
    break;
  }
}

const NODE_ENV = process.env.NODE_ENV ?? 'development';

function loadEnvVar(name: string, options: { optional?: boolean; disallowValues?: string[] } = {}) {
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

const parseOrigins = (raw: string) =>
  raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export const env = {
  nodeEnv: NODE_ENV,
  isProduction: NODE_ENV === 'production',
  port: parsePort(loadEnvVar('CODIFICATION_SERVICE_PORT'), 'CODIFICATION_SERVICE_PORT'),
  corsOrigins: parseOrigins(loadEnvVar('CORS_ORIGIN', { optional: true }) || ''),
  databaseUrl: loadEnvVar('DATABASE_URL'),
  uploadPath: loadEnvVar('UPLOAD_PATH', { optional: true }) || '/tmp/uploads',
  maxFileSize: Number.parseInt(loadEnvVar('MAX_FILE_SIZE', { optional: true }) || '10485760', 10),
};
