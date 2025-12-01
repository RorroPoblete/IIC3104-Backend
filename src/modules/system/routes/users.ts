import { Router, Request, Response } from 'express';
import { prisma } from '../../../shared/db/prisma';
import { asyncHandler } from '../../../shared/middleware/errorHandler';

const router = Router();
const ADMIN_ROLE = 'Administrador';

type UserPayload = {
  name?: string;
  email?: string;
  role?: string;
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const buildUserResponse = (user: { id: string; name: string; email: string; role: string }) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
});

const requireAdmin = (req: Request, res: Response) => {
  const role = req.authUser?.role;
  if (role !== ADMIN_ROLE) {
    res.status(403).json({ message: 'Solo los administradores pueden gestionar usuarios' });
    return false;
  }
  return true;
};

router.get(
  '/me',
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.authUser) {
      return res.status(401).json({ message: 'Sesión no válida' });
    }
    return res.json(buildUserResponse(req.authUser));
  }),
);

router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    if (!requireAdmin(_req, res)) return;

    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, email: true, role: true },
    });

    return res.json(users.map(buildUserResponse));
  }),
);

router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;

    const { name, email, role } = req.body as UserPayload;

    if (!name || !email || !role) {
      return res.status(400).json({ message: 'Los campos name, email y role son obligatorios' });
    }

    const normalizedEmail = normalizeEmail(email);

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return res.status(409).json({ message: 'Ya existe un usuario con ese correo' });
    }

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        role: role.trim(),
      },
      select: { id: true, name: true, email: true, role: true },
    });

    return res.status(201).json(buildUserResponse(user));
  }),
);

router.put(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;

    const userId = req.params.id;
    const { name, email, role } = req.body as UserPayload;

    if (!userId) {
      return res.status(400).json({ message: 'El id del usuario es obligatorio' });
    }

    if (!name || !email || !role) {
      return res.status(400).json({ message: 'Los campos name, email y role son obligatorios' });
    }

    const normalizedEmail = normalizeEmail(email);

    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const duplicateEmailUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (duplicateEmailUser && duplicateEmailUser.id !== userId) {
      return res.status(409).json({ message: 'Ya existe un usuario con ese correo' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        name: name.trim(),
        email: normalizedEmail,
        role: role.trim(),
      },
      select: { id: true, name: true, email: true, role: true },
    });

    return res.json(buildUserResponse(updated));
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;

    const userId = req.params.id;

    if (!userId) {
      return res.status(400).json({ message: 'El id del usuario es obligatorio' });
    }

    const existing = await prisma.user.findUnique({ where: { id: userId } });
    if (!existing) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    await prisma.user.delete({ where: { id: userId } });

    return res.status(204).send();
  }),
);

export const userRouter = router;
