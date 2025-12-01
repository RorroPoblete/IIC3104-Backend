import { Router, Request, Response } from 'express';
import { ReportesService } from '../services/reportesService';
import { asyncHandler } from '../../../shared/middleware/errorHandler';

const router = Router();
const reportesService = new ReportesService();

/**
 * GET /api/reportes/estadisticas-generales
 * Obtiene estadísticas generales del sistema
 */
router.get(
  '/estadisticas-generales',
  asyncHandler(async (req: Request, res: Response) => {
    const estadisticas = await reportesService.getEstadisticasGenerales();
    return res.json({ success: true, data: estadisticas });
  }),
);

/**
 * GET /api/reportes/distribucion-grd
 * Obtiene distribución de episodios por GRD
 */
router.get(
  '/distribucion-grd',
  asyncHandler(async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 10;
    const distribucion = await reportesService.getDistribucionPorGRD(limit);
    return res.json({ success: true, data: distribucion });
  }),
);

/**
 * GET /api/reportes/distribucion-convenio
 * Obtiene distribución de episodios por convenio
 */
router.get(
  '/distribucion-convenio',
  asyncHandler(async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 10;
    const distribucion = await reportesService.getDistribucionPorConvenio(limit);
    return res.json({ success: true, data: distribucion });
  }),
);

/**
 * GET /api/reportes/estadisticas-calculos
 * Obtiene estadísticas de cálculos realizados
 */
router.get(
  '/estadisticas-calculos',
  asyncHandler(async (req: Request, res: Response) => {
    const estadisticas = await reportesService.getEstadisticasCalculos();
    return res.json({ success: true, data: estadisticas });
  }),
);

/**
 * GET /api/reportes/actividad-reciente
 * Obtiene actividad reciente del sistema
 */
router.get(
  '/actividad-reciente',
  asyncHandler(async (req: Request, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 10;
    const actividad = await reportesService.getActividadReciente(limit);
    return res.json({ success: true, data: actividad });
  }),
);

/**
 * GET /api/reportes/distribucion-edad
 * Obtiene distribución de episodios por edad
 */
router.get(
  '/distribucion-edad',
  asyncHandler(async (req: Request, res: Response) => {
    const distribucion = await reportesService.getDistribucionPorEdad();
    return res.json({ success: true, data: distribucion });
  }),
);

/**
 * GET /api/reportes/distribucion-sexo
 * Obtiene distribución de episodios por sexo
 */
router.get(
  '/distribucion-sexo',
  asyncHandler(async (req: Request, res: Response) => {
    const distribucion = await reportesService.getDistribucionPorSexo();
    return res.json({ success: true, data: distribucion });
  }),
);

/**
 * GET /api/reportes/tendencia-importaciones
 * Obtiene tendencia de importaciones por mes
 */
router.get(
  '/tendencia-importaciones',
  asyncHandler(async (req: Request, res: Response) => {
    const tendencia = await reportesService.getTendenciaImportaciones();
    return res.json({ success: true, data: tendencia });
  }),
);

export const reportesRouter = router;

