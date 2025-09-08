import dotenv from 'dotenv';
dotenv.config();

export const env = {
  port: parseInt(process.env.AUTH_SERVICE_PORT || '3001', 10),
  jwtSecret: process.env.JWT_SECRET || 'dev_secret_change_me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '60m',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/healthdb',
};

