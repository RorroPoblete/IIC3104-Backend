import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt, { SignOptions, Secret } from 'jsonwebtoken';
import { prisma } from '../utils/prisma';
import { env } from '../utils/env';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

const loginLimiter = rateLimit({ windowMs: 60 * 1000, max: 5 });

const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8),
});

router.post('/api/auth/login', loginLimiter, async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Entrada inválida' });
  }
  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ message: 'Credenciales inválidas' });
  if (!user.isActive) return res.status(423).json({ message: 'Cuenta inactiva' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ message: 'Credenciales inválidas' });
  const signOptions: SignOptions = { algorithm: 'HS256', expiresIn: env.jwtExpiresIn as any };
  const token = jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    env.jwtSecret as Secret,
    signOptions
  );
  return res.json({ accessToken: token, user: { id: user.id, email: user.email, role: user.role } });
});

router.get('/api/admin/ping', requireAuth, requireRole('Admin'), (req, res) => {
  res.json({ ok: true });
});

export default router;
