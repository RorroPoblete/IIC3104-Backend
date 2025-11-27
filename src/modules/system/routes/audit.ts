import { Router, Request, Response } from 'express';
import { prisma } from '../../../shared/db/prisma';
import { asyncHandler } from '../../../shared/middleware/errorHandler';

const router = Router();

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed;
};

router.get(
  '/logs',
  asyncHandler(async (req: Request, res: Response) => {
    const { page = '1', limit = '20', userEmail, action, entityType, entityId, from, to } =
      req.query as Record<string, string>;

    const pageNumber = parsePositiveInt(page, 1);
    const take = parsePositiveInt(limit, 20);
    const skip = (pageNumber - 1) * take;

    const where: Record<string, unknown> = {};

    if (userEmail) where.userEmail = userEmail;
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;

    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      };
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return res.json({
      success: true,
      data: {
        logs,
        pagination: {
          page: pageNumber,
          limit: take,
          total,
          pages: Math.ceil(total / take),
        },
      },
    });
  }),
);

router.get(
  '/logs/:id',
  asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
    const { id } = req.params;

    const log = await prisma.auditLog.findUnique({ where: { id } });

    if (!log) {
      return res.status(404).json({ success: false, message: 'Registro de auditoría no encontrado' });
    }

    return res.json({ success: true, data: log });
  }),
);

export const auditRouter = router;
