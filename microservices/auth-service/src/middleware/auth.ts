import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../utils/env';

export type JwtPayload = { sub: string; email: string; role: 'Admin' };

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'No autorizado' });
  try {
    const payload = jwt.verify(token, env.jwtSecret) as JwtPayload;
    (req as any).user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ message: 'No autorizado' });
  }
}

export function requireRole(role: 'Admin') {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as JwtPayload | undefined;
    if (!user) return res.status(401).json({ message: 'No autorizado' });
    if (user.role !== role) return res.status(403).json({ message: 'Prohibido' });
    next();
  };
}

