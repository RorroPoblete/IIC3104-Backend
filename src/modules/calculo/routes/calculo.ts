import express, { Request, Response } from 'express';
import { asyncHandler } from '../../../shared/middleware/errorHandler';
import { logger } from '../../../shared/utils/logger';
import { CalculoService } from '../services/calculoService';

const calculoRouter = express.Router();

/**
 * POST /calculo/episodio/:id/run
 * Ejecuta el cálculo integral de un episodio (V1)
 * Body: { fechaReferencia?: string (ISO), usuario?: string }
 */
calculoRouter.post(
  '/episodio/:id/run',
  asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
    const { id: episodioId } = req.params;
    const { fechaReferencia, usuario } = req.body;

    // Validar fechaReferencia si se proporciona
    let fechaReferenciaDate: Date | undefined;
    if (fechaReferencia) {
      if (typeof fechaReferencia !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'fechaReferencia debe ser una cadena en formato ISO 8601',
        });
      }
      fechaReferenciaDate = new Date(fechaReferencia);
      if (Number.isNaN(fechaReferenciaDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'fechaReferencia debe ser una fecha válida (ISO 8601)',
        });
      }
    }

    try {
      const params: {
        episodioId: string;
        fechaReferencia?: Date | string;
        usuario?: string;
      } = {
        episodioId,
      };

      if (fechaReferenciaDate) {
        params.fechaReferencia = fechaReferenciaDate;
      }

      if (usuario) {
        params.usuario = usuario;
      }

      const resultado = await CalculoService.calcularEpisodio(params);

      return res.json({
        success: true,
        message: 'Cálculo completado exitosamente',
        data: resultado,
      });
    } catch (error) {
      logger.error('[CalculoRouter] Error al calcular episodio', {
        episodioId,
        error: error instanceof Error ? error.message : String(error),
      });

      // Errores controlados
      if (error instanceof Error) {
        const message = error.message;

        // Episodio no encontrado
        if (message.includes('no encontrado')) {
          return res.status(404).json({
            success: false,
            message,
            error: 'EPISODIO_NO_ENCONTRADO',
          });
        }

        // Sin norma
        if (message.includes('no tiene norma')) {
          return res.status(400).json({
            success: false,
            message,
            error: 'EPISODIO_SIN_NORMA',
          });
        }

        // Sin convenio
        if (message.includes('no tiene convenio')) {
          return res.status(400).json({
            success: false,
            message,
            error: 'EPISODIO_SIN_CONVENIO',
          });
        }

        // IR inválido
        if (message.includes('no tiene IR válido')) {
          return res.status(400).json({
            success: false,
            message,
            error: 'EPISODIO_SIN_IR',
          });
        }

        // Sin archivo de pricing activo
        if (message.includes('No hay archivo activo de pricing')) {
          return res.status(503).json({
            success: false,
            message,
            error: 'PRICING_FILE_UNAVAILABLE',
          });
        }

        // Convenio no disponible
        if (message.includes('no disponible en las tarifas')) {
          return res.status(404).json({
            success: false,
            message,
            error: 'CONVENIO_NO_DISPONIBLE',
          });
        }

        // Tarifa fuera de vigencia
        if (message.includes('No hay tarifas vigentes')) {
          return res.status(404).json({
            success: false,
            message,
            error: 'TARIFA_FUERA_DE_VIGENCIA',
          });
        }

        // Fuentes no disponibles
        if (message.includes('No hay fuentes de tarifas')) {
          return res.status(503).json({
            success: false,
            message,
            error: 'TARIFA_SOURCE_UNAVAILABLE',
          });
        }
      }

      // Error genérico
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      logger.error('[CalculoRouter] Error inesperado al calcular episodio', {
        episodioId,
        error: errorMessage,
        stack: errorStack,
      });

      // Si es un error de Prisma (tabla no existe), dar mensaje más claro
      if (errorMessage.includes('does not exist') || errorMessage.includes('Unknown table')) {
        return res.status(500).json({
          success: false,
          message: 'Las tablas de cálculo no existen. Ejecuta las migraciones de Prisma: npx prisma migrate deploy',
          error: 'DATABASE_SCHEMA_ERROR',
          details: errorMessage,
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Error inesperado al calcular episodio',
        error: 'INTERNAL_ERROR',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      });
    }
  }),
);

/**
 * GET /calculo/episodio/:id/versiones
 * Obtiene el historial de versiones de cálculo para un episodio
 */
calculoRouter.get(
  '/episodio/:id/versiones',
  asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
    const { id: episodioId } = req.params;

    try {
      const historial = await CalculoService.getHistorialVersiones(episodioId);

      return res.json({
        success: true,
        data: historial,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      logger.error('[CalculoRouter] Error al obtener historial', {
        episodioId,
        error: errorMessage,
        stack: errorStack,
      });

      // Si es un error de Prisma (tabla no existe), dar mensaje más claro
      if (errorMessage.includes('does not exist') || errorMessage.includes('Unknown table')) {
        return res.status(500).json({
          success: false,
          message: 'Las tablas de cálculo no existen. Ejecuta las migraciones de Prisma: npx prisma migrate deploy',
          error: 'DATABASE_SCHEMA_ERROR',
          details: errorMessage,
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Error al obtener historial de versiones',
        error: 'INTERNAL_ERROR',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      });
    }
  }),
);

/**
 * GET /calculo/version/:id
 * Obtiene el detalle completo de un cálculo específico
 */
calculoRouter.get(
  '/version/:id',
  asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
    const { id: calculoId } = req.params;

    try {
      const detalle = await CalculoService.getDetalleCalculo(calculoId);

      return res.json({
        success: true,
        data: detalle,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('no encontrado')) {
        return res.status(404).json({
          success: false,
          message: error.message,
          error: 'CALCULO_NO_ENCONTRADO',
        });
      }

      logger.error('[CalculoRouter] Error al obtener detalle de cálculo', {
        calculoId,
        error: error instanceof Error ? error.message : String(error),
      });

      return res.status(500).json({
        success: false,
        message: 'Error al obtener detalle de cálculo',
        error: 'INTERNAL_ERROR',
      });
    }
  }),
);

export { calculoRouter };

