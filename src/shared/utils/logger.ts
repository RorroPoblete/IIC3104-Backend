import winston from 'winston';
import { env } from '../../config/env';

const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

export const logger = winston.createLogger({
  level: env.logLevel,
  format: jsonFormat,
  defaultMeta: { service: 'iic3104-backend-monolith' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
  ],
});
