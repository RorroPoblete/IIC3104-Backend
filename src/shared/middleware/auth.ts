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
    logger.warn('Token de autenticación no proporcionado', { 
      hasAuthHeader: !!req.headers.authorization,
      path: req.path 
    });
    return res.status(401).json({ message: 'Token de autenticación no proporcionado' });
  }

  try {
    const { payload } = await jwtVerify(token, jwks!, {
      issuer: issuer!,
      audience: audience!,
    });

    // Log payload para debugging (sin información sensible)
    logger.info('Token payload recibido', { 
      hasEmail: !!payload.email,
      hasSub: !!payload.sub,
      payloadKeys: Object.keys(payload),
      path: req.path 
    });

    // Intentar obtener email del token
    let emailFromToken: string | null = null;
    
    // Primero intentar el campo 'email'
    if (typeof payload.email === 'string') {
      emailFromToken = payload.email.toLowerCase();
    }
    // Si no está, intentar 'https://auth0.com/user/email' (claim personalizado)
    else if (typeof (payload as any)['https://auth0.com/user/email'] === 'string') {
      emailFromToken = ((payload as any)['https://auth0.com/user/email'] as string).toLowerCase();
    }
    // Si aún no está, obtenerlo del endpoint /userinfo de Auth0
    else if (typeof payload.sub === 'string' && issuer) {
      try {
        const userInfoUrl = new URL(`${issuer}userinfo`);
        const userInfoResponse = await fetch(userInfoUrl.toString(), {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (userInfoResponse.ok) {
          const userInfo = await userInfoResponse.json() as { email?: string };
          if (typeof userInfo.email === 'string') {
            emailFromToken = userInfo.email.toLowerCase();
            logger.info('Email obtenido desde /userinfo', { 
              sub: payload.sub,
              path: req.path 
            });
          }
        } else {
          logger.warn('Error obteniendo userinfo de Auth0', { 
            status: userInfoResponse.status,
            sub: payload.sub,
            path: req.path 
          });
        }
      } catch (error) {
        logger.warn('Error llamando a /userinfo de Auth0', { 
          error: error instanceof Error ? error.message : 'Unknown',
          sub: payload.sub,
          path: req.path 
        });
      }
    }
    
    if (!emailFromToken) {
      logger.warn('No se pudo obtener email del token ni de /userinfo', { 
        hasEmail: !!payload.email,
        emailType: typeof payload.email,
        hasSub: !!payload.sub,
        sub: payload.sub,
        path: req.path,
        availableClaims: Object.keys(payload).filter(k => !k.startsWith('_'))
      });
      
      return res.status(401).json({ 
        message: 'No se pudo obtener el correo electrónico del usuario. Por favor, inicia sesión nuevamente.' 
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: emailFromToken },
    });

    if (!user) {
      logger.warn('Usuario no encontrado en base de datos', { 
        email: emailFromToken,
        path: req.path 
      });
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
    logger.warn('Error validando token', { 
      message,
      errorName: error instanceof Error ? error.name : 'Unknown',
      path: req.path 
    });
    return res.status(401).json({ message: 'Token de autenticación inválido' });
  }
};
