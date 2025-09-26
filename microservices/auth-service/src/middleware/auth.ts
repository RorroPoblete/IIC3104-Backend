import { Request, Response, NextFunction } from 'express';
import { expressjwt, Request as JWTRequest } from 'express-jwt';
import jwksRsa from 'jwks-rsa';
import { env } from '../utils/env';

export type Auth0JwtPayload = Record<string, any> & { sub: string };

export const requireAuth = expressjwt({
  secret: jwksRsa.expressJwtSecret({
    jwksUri: `https://${env.auth0Domain}/.well-known/jwks.json`,
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
  }) as any,
  audience: env.auth0Audience,
  issuer: `https://${env.auth0Domain}/`,
  algorithms: ['RS256'],
});

export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as JWTRequest;
    const payload = (authReq.auth || {}) as Auth0JwtPayload | undefined;
    if (!payload) return res.status(401).json({ message: 'No autorizado' });
    // Ajusta aquí la fuente del rol según tu claim (por ejemplo, permissions o namespace)
    const tokenRole = (payload as any)['https://uc/role'] || (payload as any).role;
    if (role && tokenRole !== role) return res.status(403).json({ message: 'Prohibido' });
    next();
  };
}

