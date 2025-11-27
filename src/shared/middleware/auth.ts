import { NextFunction, Request, Response } from 'express';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';
import { env } from '../../config/env';
import { prisma } from '../db/prisma';
import { logger } from '../utils/logger';

export type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  tokenPayload: JWTPayload;
};

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthenticatedUser;
    }
  }
}

const issuer = env.auth0Domain ? `https://${env.auth0Domain}/` : null;
const audience = env.auth0Audience || null;
const jwksUri = issuer ? new URL(`${issuer}.well-known/jwks.json`) : null;
const jwks = jwksUri ? createRemoteJWKSet(jwksUri) : null;

const missingAuthConfig = !issuer || !audience || !jwks;

const getBearerToken = (authorizationHeader?: string) => {
  if (!authorizationHeader) return null;
  const [scheme, token] = authorizationHeader.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) return null;
  return token;
};

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  if (missingAuthConfig) {
    logger.error('Faltan variables de entorno de Auth0. Revisar AUTH0_DOMAIN y AUTH0_AUDIENCE.');
    return res.status(500).json({ message: 'Configuración de autenticación incompleta' });
  }

  const token = getBearerToken(req.headers.authorization);
  if (!token) {
    return res.status(401).json({ message: 'Token de autenticación no proporcionado' });
  }

  try {
    const { payload } = await jwtVerify(token, jwks!, {
      issuer: issuer!,
      audience: audience!,
    });

    const emailFromToken = typeof payload.email === 'string' ? payload.email.toLowerCase() : null;
    if (!emailFromToken) {
      return res.status(401).json({ message: 'El token no incluye un correo electrónico válido' });
    }

    const user = await prisma.user.findUnique({
      where: { email: emailFromToken },
    });

    if (!user) {
      return res.status(403).json({ message: 'Usuario no autorizado para acceder' });
    }

    req.authUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      tokenPayload: payload,
    };

    return next();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Token inválido';
    logger.warn('Error validando token', { message });
    return res.status(401).json({ message: 'Token de autenticación inválido' });
  }
};
