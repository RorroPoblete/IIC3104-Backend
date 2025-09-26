import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

// Eliminado login local: ahora el frontend obtiene token desde Auth0

router.get('/api/admin/ping', requireAuth, (req, res) => {
  res.json({ ok: true });
});

router.get('/api/me', requireAuth, (req, res) => {
  res.json({ auth: (req as any).auth });
});

export default router;
