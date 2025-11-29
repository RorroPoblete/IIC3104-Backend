import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Prisma, PricingTarifa } from '@prisma/client';
import {
  configurePricing,
  ConvenioTipo,
  ConvenioNoDisponibleError,
  PesoRelativoInvalidoError,
  TarifaFueraDeVigenciaError,
  TarifaSourceUnavailableError,
  PricingError,
} from '../../../../packages/rules/pricing';
import { prisma } from '../../../shared/db/prisma';
import { asyncHandler } from '../../../shared/middleware/errorHandler';
import { env } from '../../../config/env';
import { logger } from '../../../shared/utils/logger';
import { PricingParser, PricingRawRow } from '../utils/pricingParser';
import { PrismaPricingTarifaRepository } from '../repositories/prismaPricingRepository';
import { PricingService } from '../services/pricingService';
import { requirePermission } from '../../../shared/middleware/rolePermissions';

const pricingRouter = express.Router();

configurePricing({
  repository: new PrismaPricingTarifaRepository(),
});

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(env.uploadPath)) {
      fs.mkdirSync(env.uploadPath, { recursive: true });
    }
    cb(null, env.uploadPath);
  },
  filename: (_req, file, cb) => {
    const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `pricing-${suffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: env.maxFileSize },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.csv', '.xlsx', '.xls'];
    if (allowed.includes(ext)) {
      return cb(null, true);
    }
    return cb(
      new Error('Solo se permiten archivos CSV o Excel (.xls, .xlsx)'),
    );
  },
});

pricingRouter.post(
  '/import',
  requirePermission('pricing.modify'),
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: 'No se proporcionó ningún archivo' });
    }

    const { path: filePath, originalname } = req.file;
    const { description } = req.body;
    let fileId: string | null = null;

    try {
      const fileRecord = await prisma.pricingFile.create({
        data: {
          filename: originalname,
          description: description?.toString() || null,
          status: 'PROCESSING',
        },
      });

      fileId = fileRecord.id;
      const parseResult = await PricingParser.parseFile(filePath);
      await prisma.pricingFile.update({
        where: { id: fileId },
        data: { totalRows: parseResult.totalRows },
      });

      const batchSize = 500;
      let processedRows = 0;
      let errorRows = 0;

      for (let index = 0; index < parseResult.rows.length; index += batchSize) {
        const batch = parseResult.rows.slice(index, index + batchSize);
        const normalizedRows = batch
          .map((row) => normalizePricingRow(row))
          .filter((row): row is NormalizedTarifaRow => {
            if (row) {
              return true;
            }
            errorRows += 1;
            return false;
          })
          .map((row) => ({
            fileId: fileRecord.id,
            aseguradoraCodigo: row.aseguradoraCodigo ?? null,
            aseguradoraNombre: row.aseguradoraNombre ?? null,
            convenioId: row.convenioId,
            descripcionConvenio: row.descripcionConvenio ?? null,
            tipoAseguradora: row.tipoAseguradora ?? null,
            tipoConvenio: row.tipoConvenio ?? null,
            tramo: row.tramo ?? null,
            precio: row.precio,
            fechaAdmision: row.fechaAdmision ?? null,
            fechaFin: row.fechaFin ?? null,
            rawData: row.rawData,
          }));

        if (normalizedRows.length > 0) {
          await prisma.pricingTarifa.createMany({ data: normalizedRows });
          processedRows += normalizedRows.length;
        }
      }

      const status =
        errorRows > 0 && processedRows > 0
          ? 'PARTIALLY_COMPLETED'
          : errorRows === parseResult.rows.length
            ? 'FAILED'
            : 'COMPLETED';

      await prisma.pricingFile.update({
        where: { id: fileRecord.id },
        data: {
          processedRows,
          errorRows,
          status,
          completedAt: new Date(),
        },
      });

      const hasActive = await prisma.pricingFile.findFirst({
        where: { isActive: true },
      });
      if (!hasActive && status === 'COMPLETED') {
        await prisma.pricingFile.update({
          where: { id: fileRecord.id },
          data: { isActive: true },
        });
      }

      return res.json({
        success: true,
        message: 'Importación de tarifas completada',
        data: {
          fileId: fileRecord.id,
          processedRows,
          errorRows,
          totalRows: parseResult.totalRows,
          status,
        },
      });
    } catch (error) {
      logger.error('[PricingImport] Error procesando archivo', error);
      if (fileId) {
        await prisma.pricingFile.update({
          where: { id: fileId },
          data: { status: 'FAILED' },
        });
      }
      throw error;
    } finally {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  }),
);

pricingRouter.get(
  '/import/active',
  asyncHandler(async (_req: Request, res: Response) => {
    const file = await prisma.pricingFile.findFirst({
      where: { isActive: true },
      include: {
        _count: { select: { tarifas: true } },
      },
    });

    if (!file) {
      return res
        .status(404)
        .json({ success: false, message: 'No hay archivo activo' });
    }

    return res.json({ success: true, data: file });
  }),
);

pricingRouter.get(
  '/import/files',
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, skip } = getPagination(req, 10);

    const [files, total] = await Promise.all([
      prisma.pricingFile.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { tarifas: true },
          },
        },
      }),
      prisma.pricingFile.count(),
    ]);

    return res.json({
      success: true,
      data: {
        files,
        pagination: buildPagination(page, limit, total),
      },
    });
  }),
);

// IMPORTANTE: Las rutas más específicas deben ir ANTES de las genéricas
pricingRouter.get(
  '/import/files/:id/data',
  asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
    const { id } = req.params;
    const { page, limit, skip } = getPagination(req, 100);

    const [data, total] = await Promise.all([
      prisma.pricingTarifa.findMany({
        where: { fileId: id },
        skip,
        take: limit,
        orderBy: [{ convenioId: 'asc' }, { tramo: 'asc' }, { fechaAdmision: 'desc' }],
      }),
      prisma.pricingTarifa.count({
        where: { fileId: id },
      }),
    ]);

    const payload = data.map((row: PricingTarifa) => ({
      id: row.id,
      convenioId: row.convenioId,
      descripcion: row.descripcionConvenio,
      tramo: row.tramo as 'T1' | 'T2' | 'T3' | null,
      precio: Number(row.precio),
      fechaAdmision: row.fechaAdmision,
      fechaFin: row.fechaFin,
      tipoConvenio: row.tipoConvenio,
      tipoAseguradora: row.tipoAseguradora,
      aseguradoraCodigo: row.aseguradoraCodigo,
      aseguradoraNombre: row.aseguradoraNombre,
    }));

    return res.json({
      success: true,
      data: {
        data: payload,
        pagination: buildPagination(page, limit, total),
      },
    });
  }),
);

pricingRouter.patch(
  '/import/files/:id/activate',
  requirePermission('pricing.modify'),
  asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
    const { id } = req.params;
    const file = await prisma.pricingFile.findUnique({ where: { id } });
    if (!file) {
      return res
        .status(404)
        .json({ success: false, message: 'Archivo no encontrado' });
    }

    await prisma.pricingFile.updateMany({ data: { isActive: false } });
    await prisma.pricingFile.update({
      where: { id },
      data: { isActive: true },
    });

    return res.json({
      success: true,
      message: 'Archivo activado correctamente',
      data: { fileId: id },
    });
  }),
);

pricingRouter.get(
  '/import/files/:id',
  asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
    const { id } = req.params;
    const file = await prisma.pricingFile.findUnique({
      where: { id },
      include: {
        _count: { select: { tarifas: true } },
      },
    });

    if (!file) {
      return res
        .status(404)
        .json({ success: false, message: 'Archivo no encontrado' });
    }

    return res.json({ success: true, data: file });
  }),
);

pricingRouter.get(
  '/prices/:convenioId',
  asyncHandler(async (req: Request<{ convenioId: string }>, res: Response) => {
    const { convenioId } = req.params;
    const { fileId, tramo } = req.query;

    if (!convenioId) {
      return res
        .status(400)
        .json({ success: false, message: 'Debe especificar un convenio' });
    }

    let targetFileId: string | undefined;
    if (typeof fileId === 'string' && fileId.length > 0) {
      targetFileId = fileId;
    } else {
      const activeFile = await prisma.pricingFile.findFirst({
        where: { isActive: true },
      });
      if (!activeFile) {
        return res
          .status(404)
          .json({ success: false, message: 'No hay archivo activo configurado' });
      }
      targetFileId = activeFile.id;
    }

    const where: {
      convenioId: string;
      fileId: string;
      tramo?: string;
    } = {
      convenioId,
      fileId: targetFileId,
    };

    if (typeof tramo === 'string' && tramo.trim().length > 0) {
      where.tramo = tramo.toUpperCase();
    }

    const data = await prisma.pricingTarifa.findMany({
      where,
      orderBy: [{ tramo: 'asc' }, { fechaAdmision: 'desc' }],
    });

    if (!data.length) {
      return res.status(404).json({
        success: false,
        message: 'No se encontraron tarifas para los filtros entregados',
      });
    }

    const payload = data.map((row: PricingTarifa) => ({
      id: row.id,
      convenioId: row.convenioId,
      descripcion: row.descripcionConvenio,
      tramo: row.tramo as 'T1' | 'T2' | 'T3' | null,
      precio: Number(row.precio),
      fechaAdmision: row.fechaAdmision,
      fechaFin: row.fechaFin,
      tipoConvenio: row.tipoConvenio,
      tipoAseguradora: row.tipoAseguradora,
      aseguradoraCodigo: row.aseguradoraCodigo,
      aseguradoraNombre: row.aseguradoraNombre,
    }));

    return res.json({
      success: true,
      data: {
        fileId: targetFileId,
        tipo: data.some((row: PricingTarifa) => row.tramo)
          ? ConvenioTipo.POR_TRAMOS
          : ConvenioTipo.PRECIO_UNICO,
        precios: payload,
      },
    });
  }),
);

pricingRouter.get(
  '/calculate',
  asyncHandler(async (req: Request, res: Response) => {
    const { convenioId, pesoRelativo, fechaReferencia } = req.query;

    if (!convenioId || typeof convenioId !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Debe especificar un convenioId',
      });
    }

    if (!pesoRelativo) {
      return res.status(400).json({
        success: false,
        message: 'Debe especificar un pesoRelativo',
      });
    }

    const pesoRelativoNumber = Number(pesoRelativo);
    if (!Number.isFinite(pesoRelativoNumber) || pesoRelativoNumber <= 0) {
      return res.status(400).json({
        success: false,
        message: 'El pesoRelativo debe ser un número mayor que 0',
      });
    }

    let fechaReferenciaDate: Date | undefined;
    if (fechaReferencia) {
      if (typeof fechaReferencia === 'string') {
        fechaReferenciaDate = new Date(fechaReferencia);
        if (Number.isNaN(fechaReferenciaDate.getTime())) {
          return res.status(400).json({
            success: false,
            message: 'La fechaReferencia debe ser una fecha válida (ISO 8601)',
          });
        }
      }
    }

    try {
      const requestParams: {
        convenioId: string;
        pesoRelativo: number;
        fechaReferencia?: Date | string;
      } = {
        convenioId,
        pesoRelativo: pesoRelativoNumber,
      };

      if (fechaReferenciaDate) {
        requestParams.fechaReferencia = fechaReferenciaDate;
      }

      const resultado = await PricingService.calculatePrecioBase(requestParams);

      return res.json({
        success: true,
        data: resultado,
      });
    } catch (error) {
      if (error instanceof ConvenioNoDisponibleError) {
        return res.status(404).json({
          success: false,
          message: error.message,
          error: 'CONVENIO_NO_DISPONIBLE',
        });
      }

      if (error instanceof PesoRelativoInvalidoError) {
        return res.status(400).json({
          success: false,
          message: error.message,
          error: 'PESO_RELATIVO_INVALIDO',
        });
      }

      if (error instanceof TarifaFueraDeVigenciaError) {
        return res.status(404).json({
          success: false,
          message: error.message,
          error: 'TARIFA_FUERA_DE_VIGENCIA',
        });
      }

      if (error instanceof TarifaSourceUnavailableError) {
        return res.status(503).json({
          success: false,
          message: error.message,
          error: 'TARIFA_SOURCE_UNAVAILABLE',
        });
      }

      if (error instanceof PricingError) {
        return res.status(500).json({
          success: false,
          message: error.message,
          error: 'PRICING_ERROR',
        });
      }

      logger.error('[PricingCalculate] Error inesperado', error);
      return res.status(500).json({
        success: false,
        message: 'Error inesperado al calcular precio base',
        error: 'INTERNAL_ERROR',
      });
    }
  }),
);

pricingRouter.put(
  '/import/files/:fileId/data/:id',
  requirePermission('pricing.modify'),
  asyncHandler(async (req: Request<{ fileId: string; id: string }>, res: Response) => {
    const { id, fileId } = req.params;
    const { precio, fechaAdmision, fechaFin, tramo } = req.body;

    if (!id || !fileId) {
      return res.status(400).json({ success: false, message: 'ID de archivo y tarifa son obligatorios' });
    }

    const existing = await prisma.pricingTarifa.findFirst({
      where: { id, fileId },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Tarifa no encontrada' });
    }

    const updateData: {
      precio?: Prisma.Decimal;
      fechaAdmision?: Date | null;
      fechaFin?: Date | null;
      tramo?: string | null;
    } = {};

    if (precio !== undefined) {
      const precioNumber = Number(precio);
      if (!Number.isFinite(precioNumber) || precioNumber < 0) {
        return res.status(400).json({ success: false, message: 'El precio debe ser un número válido mayor o igual a 0' });
      }
      updateData.precio = new Prisma.Decimal(precioNumber);
    }

    if (fechaAdmision !== undefined) {
      updateData.fechaAdmision = fechaAdmision ? new Date(fechaAdmision) : null;
    }

    if (fechaFin !== undefined) {
      updateData.fechaFin = fechaFin ? new Date(fechaFin) : null;
    }

    if (tramo !== undefined) {
      updateData.tramo = tramo ? tramo.toUpperCase() : null;
    }

    const updated = await prisma.pricingTarifa.update({
      where: { id },
      data: updateData,
    });

    return res.json({
      success: true,
      data: {
        id: updated.id,
        convenioId: updated.convenioId,
        descripcion: updated.descripcionConvenio,
        tramo: updated.tramo,
        precio: Number(updated.precio),
        fechaAdmision: updated.fechaAdmision,
        fechaFin: updated.fechaFin,
      },
    });
  }),
);

type NormalizedTarifaRow = {
  aseguradoraCodigo?: string;
  aseguradoraNombre?: string;
  convenioId: string;
  descripcionConvenio?: string;
  tipoAseguradora?: string;
  tipoConvenio?: string;
  tramo?: string;
  precio: Prisma.Decimal;
  fechaAdmision?: Date;
  fechaFin?: Date;
  rawData: PricingRawRow;
};

function normalizePricingRow(
  row: PricingRawRow,
): NormalizedTarifaRow | null {
  const convenioId = pickString(row, 'convenio', 'Convenio', 'COD');
  const precioRaw = row['Precio'] ?? row['precio'];

  if (!convenioId) {
    return null;
  }

  const precioNumber = typeof precioRaw === 'number' ? precioRaw : Number(precioRaw);
  if (!Number.isFinite(precioNumber) || precioNumber <= 0) {
    return null;
  }

  const tramo = sanitizeTramo(row['Tramo'] ?? row['tramo']);

  const normalized: NormalizedTarifaRow = {
    convenioId,
    precio: new Prisma.Decimal(precioNumber),
    rawData: row,
  };

  const aseguradora = pickString(row, 'Aseguradora');
  if (aseguradora) {
    normalized.aseguradoraCodigo = aseguradora;
  }

  const nombreAseguradora = pickString(
    row,
    'nombre_aseguradora',
    'Nombre Aseguradora',
  );
  if (nombreAseguradora) {
    normalized.aseguradoraNombre = nombreAseguradora;
  }

  const descripcion = pickString(row, 'descr_convenio', 'Descripcion');
  if (descripcion) {
    normalized.descripcionConvenio = descripcion;
  }

  const tipoAseguradora = pickString(row, 'Tipo Aseguradora');
  if (tipoAseguradora) {
    normalized.tipoAseguradora = tipoAseguradora;
  }

  const tipoConvenio = pickString(row, 'Tipo convenio', 'Tipo Convenio');
  if (tipoConvenio) {
    normalized.tipoConvenio = tipoConvenio;
  }

  if (tramo) {
    normalized.tramo = tramo;
  }

  const fechaAd = pickDate(row['fecha admisión'] ?? row['Fecha Admision']);
  if (fechaAd) {
    normalized.fechaAdmision = fechaAd;
  }
  const fechaFin = pickDate(row['fecha fin'] ?? row['Fecha Fin']);
  if (fechaFin) {
    normalized.fechaFin = fechaFin;
  }

  return normalized;
}

function pickString(row: PricingRawRow, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const raw = row[key];
    if (raw === null || raw === undefined) {
      continue;
    }
    const value = String(raw).trim();
    if (value.length > 0) {
      return value;
    }
  }
  return undefined;
}

function pickDate(value: unknown): Date | undefined {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return undefined;
}

function sanitizeTramo(value: unknown): string | undefined {
  if (!value) {
    return undefined;
  }
  const normalized = String(value).trim().toUpperCase();
  if (['T1', 'T2', 'T3'].includes(normalized)) {
    return normalized;
  }
  return undefined;
}

function getPagination(req: Request, defaultLimit: number) {
  const page = Math.max(
    1,
    Number.parseInt((req.query.page as string) ?? '1', 10) || 1,
  );
  const limit = Math.max(
    1,
    Number.parseInt((req.query.limit as string) ?? `${defaultLimit}`, 10) ||
      defaultLimit,
  );
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function buildPagination(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
  };
}

export { pricingRouter };
