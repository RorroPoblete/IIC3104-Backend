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

// Log de configuración al cargar el módulo (solo una vez)
if (missingAuthConfig) {
  const missingVars: string[] = [];
  if (!env.auth0Domain) missingVars.push('AUTH0_DOMAIN');
  if (!env.auth0Audience) missingVars.push('AUTH0_AUDIENCE');
  logger.error('Configuración de Auth0 incompleta. Variables faltantes:', { 
    missing: missingVars,
    hasDomain: !!env.auth0Domain,
    hasAudience: !!env.auth0Audience,
    hasClientId: !!env.auth0ClientId,
  });
}

// Cache simple para emails obtenidos desde /userinfo (evita rate limiting)
// Key: sub (subject), Value: { email: string, expiresAt: number }
const emailCache = new Map<string, { email: string; expiresAt: number }>();
const EMAIL_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

const getBearerToken = (authorizationHeader?: string) => {
  if (!authorizationHeader) return null;
  const [scheme, token] = authorizationHeader.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) return null;
  return token;
};

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  if (missingAuthConfig) {
    const missingVars: string[] = [];
    if (!env.auth0Domain) missingVars.push('AUTH0_DOMAIN');
    if (!env.auth0Audience) missingVars.push('AUTH0_AUDIENCE');
    
    logger.error('Faltan variables de entorno de Auth0', { 
      missing: missingVars,
      path: req.path 
    });
    return res.status(500).json({ 
      message: 'Configuración de autenticación incompleta',
      missing: missingVars,
      hint: 'Configura las variables de entorno AUTH0_DOMAIN y AUTH0_AUDIENCE en Render'
    });
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
    
    // Primero intentar el campo 'email' directamente
    if (typeof payload.email === 'string' && payload.email.trim()) {
      emailFromToken = payload.email.toLowerCase().trim();
      logger.info('Email obtenido del campo email del token', { 
        email: emailFromToken,
        path: req.path 
      });
    }
    // Si no está, intentar 'https://auth0.com/user/email' (claim personalizado)
    else if (typeof (payload as any)['https://auth0.com/user/email'] === 'string') {
      emailFromToken = ((payload as any)['https://auth0.com/user/email'] as string).toLowerCase().trim();
      logger.info('Email obtenido del claim personalizado', { 
        email: emailFromToken,
        path: req.path 
      });
    }
    // Si aún no está, intentar otros claims comunes
    else {
      // Buscar en todos los claims que puedan contener email
      const possibleEmailKeys = Object.keys(payload).filter(key => 
        key.toLowerCase().includes('email') || 
        key.toLowerCase().includes('mail')
      );
      
      for (const key of possibleEmailKeys) {
        const value = (payload as any)[key];
        if (typeof value === 'string' && value.includes('@')) {
          emailFromToken = value.toLowerCase().trim();
          logger.info('Email obtenido de claim alternativo', { 
            claim: key,
            email: emailFromToken,
            path: req.path 
          });
          break;
        }
      }
    }
    
    // Si aún no está, intentar obtenerlo del cache o del endpoint /userinfo de Auth0
    if (!emailFromToken && typeof payload.sub === 'string' && issuer) {
      // Primero verificar el cache
      const cached = emailCache.get(payload.sub);
      if (cached && cached.expiresAt > Date.now()) {
        emailFromToken = cached.email;
        logger.info('Email obtenido del cache', { 
          email: emailFromToken,
          sub: payload.sub,
          path: req.path 
        });
      } else {
        // Limpiar entrada expirada si existe
        if (cached) {
          emailCache.delete(payload.sub);
        }
        
        // Intentar obtener desde /userinfo
        try {
          logger.info('Intentando obtener email desde /userinfo', { 
            sub: payload.sub,
            path: req.path 
          });
          
          const userInfoUrl = new URL(`${issuer}userinfo`);
          const userInfoResponse = await fetch(userInfoUrl.toString(), {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json',
            },
          });

          if (userInfoResponse.ok) {
            const userInfo = await userInfoResponse.json() as { email?: string; [key: string]: any };
            logger.info('Respuesta de /userinfo recibida', { 
              hasEmail: !!userInfo.email,
              userInfoKeys: Object.keys(userInfo),
              sub: payload.sub,
              path: req.path 
            });
            
            if (typeof userInfo.email === 'string' && userInfo.email.trim()) {
              emailFromToken = userInfo.email.toLowerCase().trim();
              // Guardar en cache
              emailCache.set(payload.sub, {
                email: emailFromToken,
                expiresAt: Date.now() + EMAIL_CACHE_TTL,
              });
              logger.info('Email obtenido desde /userinfo y guardado en cache', { 
                email: emailFromToken,
                sub: payload.sub,
                path: req.path 
              });
            } else {
              logger.warn('Email no encontrado en respuesta de /userinfo', { 
                userInfoKeys: Object.keys(userInfo),
                sub: payload.sub,
                path: req.path 
              });
            }
          } else {
            const errorText = await userInfoResponse.text().catch(() => 'Unable to read error');
            const status = userInfoResponse.status;
            
            // Si es rate limit (429), intentar usar cache si existe (aunque esté expirado)
            if (status === 429 && cached) {
              emailFromToken = cached.email;
              logger.warn('Rate limit en /userinfo, usando email del cache (puede estar expirado)', { 
                email: emailFromToken,
                sub: payload.sub,
                path: req.path 
              });
            } else {
              logger.warn('Error obteniendo userinfo de Auth0', { 
                status,
                statusText: userInfoResponse.statusText,
                errorBody: errorText.substring(0, 200),
                sub: payload.sub,
                path: req.path 
              });
            }
          }
        } catch (error) {
          // Si hay error de red, intentar usar cache si existe
          if (cached) {
            emailFromToken = cached.email;
            logger.warn('Error de red llamando a /userinfo, usando email del cache (puede estar expirado)', { 
              email: emailFromToken,
              error: error instanceof Error ? error.message : 'Unknown',
              sub: payload.sub,
              path: req.path 
            });
          } else {
            logger.warn('Error llamando a /userinfo de Auth0', { 
              error: error instanceof Error ? error.message : 'Unknown',
              errorName: error instanceof Error ? error.name : 'Unknown',
              sub: payload.sub,
              path: req.path 
            });
          }
        }
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

    let user = await prisma.user.findUnique({
      where: { email: emailFromToken },
    });

    // Auto-registrar usuario si no existe (primer login)
    if (!user) {
      logger.info('Nuevo usuario detectado, auto-registrando', { 
        email: emailFromToken,
        path: req.path 
      });
      
      try {
        // Obtener nombre del token o usar email como fallback
        const userName: string = (payload.name as string) || 
                                 (payload.nickname as string) || 
                                 emailFromToken.split('@')[0] ||
                                 'Usuario';
        
        user = await prisma.user.create({
          data: {
            email: emailFromToken,
            name: userName,
            role: 'Codificador', // Rol por defecto para nuevos usuarios
          },
        });
        
        logger.info('Usuario auto-registrado exitosamente', { 
          userId: user.id,
          email: user.email,
          role: user.role 
        });
      } catch (error) {
        logger.error('Error auto-registrando usuario', { 
          email: emailFromToken,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        return res.status(500).json({ 
          message: 'Error registrando usuario automáticamente' 
        });
      }
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
