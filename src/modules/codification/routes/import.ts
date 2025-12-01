import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../../../shared/db/prisma';
import { logger } from '../../../shared/utils/logger';
import { CsvParser } from '../utils/csvParser';
import { DataNormalizer } from '../utils/dataNormalizer';
import { NormaMinsalEnricher } from '../services/normaMinsalEnricher';
import { asyncHandler } from '../../../shared/middleware/errorHandler';
import { env } from '../../../config/env';
import { requirePermission } from '../../../shared/middleware/rolePermissions';
import { getRequestActor, logAuditEvent } from '../../../shared/utils/auditLogger';

const router = express.Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(env.uploadPath)) {
      fs.mkdirSync(env.uploadPath, { recursive: true });
    }
    cb(null, env.uploadPath);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `import-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: env.maxFileSize },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = ['.csv', '.xlsx'];
    if (allowedExtensions.includes(ext)) {
      return cb(null, true);
    }
    return cb(new Error('Solo se permiten archivos CSV y XLSX'));
  },
});

const parsePositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed;
};

const getPagination = (req: Request, defaultLimit: number) => {
  const page = parsePositiveInt(req.query.page as string, 1);
  const limit = parsePositiveInt(req.query.limit as string, defaultLimit);
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

router.post(
  '/csv',
  requirePermission('codification.upload'),
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    const actor = getRequestActor(req);
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No se proporcionó ningún archivo' });
    }

    const { path: filePath, originalname: filename } = req.file;
    let batchId: string | null = null;
    let processedRows = 0;
    let errorRows = 0;

    logger.info(`Importando archivo ${filename}`);

    try {
      const batch = await prisma.importBatch.create({
        data: {
          filename,
          status: 'PROCESSING',
        },
      });

      batchId = batch.id;

      const parseResult = await CsvParser.parseFile(filePath);

      if (parseResult.errors.length > 0) {
        logger.warn(`Errores durante el parseo: ${parseResult.errors.join(', ')}`);
      }

      await prisma.importBatch.update({
        where: { id: batch.id },
        data: { totalRows: parseResult.totalRows },
      });

      const batchSize = 100;

      for (let index = 0; index < parseResult.rows.length; index += batchSize) {
        const rows = parseResult.rows.slice(index, index + batchSize);

        try {
          await prisma.importStagingRow.createMany({
            data: rows.map((row, offset) => ({
              batchId: batch.id,
              rowNumber: index + offset + 1,
              rawData: row,
            })),
          });

          // Normalizar los datos
          const normalizedRows = rows.map((row) => DataNormalizer.normalizeRow(row));

          // Preparar datos para enriquecimiento batch
          const enrichmentData = normalizedRows.map((normalized) => ({
            grdCode: normalized.irGrdCodigo || normalized.irGrd || null,
            gravedad: normalized.irGravedad || null,
          }));

          // Enriquecer con datos de Norma MINSAL en batch
          const enrichmentMap = await NormaMinsalEnricher.enrichBatch(enrichmentData);

          // Combinar datos normalizados con datos enriquecidos
          const enrichedRows = normalizedRows.map((normalized) => {
            const grdCode = normalized.irGrdCodigo || normalized.irGrd || null;
            const enrichment = grdCode
              ? enrichmentMap.get(grdCode.trim()) || {
                  pesoTotalNorma: null,
                  pesoTotalDepuNorma: null,
                  estMediaNorma: null,
                  gravedadNorma: null,
                  tieneNorma: false,
                }
              : {
                  pesoTotalNorma: null,
                  pesoTotalDepuNorma: null,
                  estMediaNorma: null,
                  gravedadNorma: null,
                  tieneNorma: false,
                };

            return {
              batchId: batch.id,
              ...normalized,
              ...enrichment,
            };
          });

          await prisma.normalizedData.createMany({
            data: enrichedRows,
          });

          processedRows += rows.length;

          await prisma.importBatch.update({
            where: { id: batch.id },
            data: { processedRows },
          });

          logger.info(`Procesadas ${processedRows}/${parseResult.totalRows} filas`);
        } catch (error) {
          logger.error(`Error procesando filas ${index + 1}-${index + rows.length}`, error);
          errorRows += rows.length;
        }
      }

      const status = errorRows > 0 ? 'PARTIALLY_COMPLETED' : 'COMPLETED';

      await prisma.importBatch.update({
        where: { id: batch.id },
        data: {
          status,
          errorRows,
          completedAt: new Date(),
        },
      });

      await logAuditEvent(
        {
          action: 'CODIFICATION_IMPORT_COMPLETED',
          entityType: 'importBatch',
          entityId: batch.id,
          description: `Importación de codificación ${filename} finalizada con estado ${status}`,
          metadata: {
            filename,
            totalRows: parseResult.totalRows,
            processedRows,
            errorRows,
            status,
          },
        },
        actor,
      );

      return res.json({
        success: true,
        message: 'Importación completada',
        data: {
          batchId: batch.id,
          totalRows: parseResult.totalRows,
          processedRows,
          errorRows,
          status,
          parseErrors: parseResult.errors,
        },
      });
    } catch (error) {
      logger.error('Error durante la importación', error);

      if (batchId) {
        await prisma.importBatch.update({
          where: { id: batchId },
          data: { status: 'FAILED' },
        });

        await logAuditEvent(
          {
            action: 'CODIFICATION_IMPORT_FAILED',
            entityType: 'importBatch',
            entityId: batchId,
            description: `Importación de codificación ${filename} falló`,
            metadata: {
              filename,
              error: error instanceof Error ? error.message : 'unknown',
            },
          },
          actor,
        );
      }

      throw error;
    } finally {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  }),
);

router.get(
  '/batches',
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, skip } = getPagination(req, 10);

    const [batches, total] = await Promise.all([
      prisma.importBatch.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              stagingRows: true,
              normalizedData: true,
            },
          },
        },
      }),
      prisma.importBatch.count(),
    ]);

    return res.json({
      success: true,
      data: {
        batches,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  }),
);

router.get(
  '/batches/:id',
  asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ success: false, message: 'Debe especificarse un ID de lote' });
    }

    const batch = await prisma.importBatch.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            stagingRows: true,
            normalizedData: true,
          },
        },
      },
    });

    if (!batch) {
      return res.status(404).json({ success: false, message: 'Lote no encontrado' });
    }

    return res.json({ success: true, data: batch });
  }),
);

router.get(
  '/batches/:id/staging',
  asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ success: false, message: 'Debe especificarse un ID de lote' });
    }

    const { page, limit, skip } = getPagination(req, 100);

    const [stagingRows, total] = await Promise.all([
      prisma.importStagingRow.findMany({
        where: { batchId: id },
        skip,
        take: limit,
        orderBy: { rowNumber: 'asc' },
      }),
      prisma.importStagingRow.count({
        where: { batchId: id },
      }),
    ]);

    return res.json({
      success: true,
      data: {
        stagingRows,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  }),
);

router.get(
  '/batches/:id/normalized',
  asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ success: false, message: 'Debe especificarse un ID de lote' });
    }

    const { page, limit, skip } = getPagination(req, 100);

    const [normalizedData, total] = await Promise.all([
      prisma.normalizedData.findMany({
        where: { batchId: id },
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
      }),
      prisma.normalizedData.count({
        where: { batchId: id },
      }),
    ]);

    return res.json({
      success: true,
      data: {
        normalizedData,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  }),
);

router.put(
  '/batches/:batchId/normalized/:id',
  asyncHandler(async (req: Request<{ batchId: string; id: string }>, res: Response) => {
    const { id, batchId } = req.params;
    const updateData = req.body;

    if (!id || !batchId) {
      return res.status(400).json({ success: false, message: 'ID de lote y registro son obligatorios' });
    }

    // Verificar que el registro existe y pertenece al lote
    const existing = await prisma.normalizedData.findFirst({
      where: { id, batchId },
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Registro no encontrado' });
    }

    // Validar permisos según el rol del usuario
    const userRole = req.authUser?.role;
    const allowedFields: string[] = [];

    if (userRole === 'Administrador') {
      // Administrador puede editar todos los campos
      allowedFields.push(...Object.keys(updateData));
    } else if (userRole === 'Codificador') {
      // Codificador puede editar campos de AT y documentación
      allowedFields.push(
        'proced01Principal',
        'conjuntoProcedimientosSecundarios',
        'diagnosticoPrincipal',
        'conjuntoDx',
        'especialidadMedica',
        'medicoEgreso',
        'especialidadEgreso',
        'servicioIngresoDesc',
        'servicioEgresoDesc',
        'motivoEgreso',
        'fechaIngresoCompleta',
        'fechaCompleta',
        'estanciaEpisodio',
        'estanciaRealEpisodio',
        'horasEstancia',
        'facturacionTotal',
        'emNorma',
        'estanciasNorma',
        'casosNorma',
      );
    } else if (userRole === 'Finanzas') {
      // Finanzas puede editar campos de validación
      allowedFields.push('validacion', 'estadoRN', 'diasDemora');
    }

    // Filtrar solo los campos permitidos
    const filteredData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in updateData) {
        filteredData[field] = updateData[field];
      }
    }

    if (Object.keys(filteredData).length === 0) {
      return res.status(403).json({ 
        success: false, 
        message: 'No tienes permisos para editar los campos proporcionados' 
      });
    }

    // Actualizar el registro
    const updated = await prisma.normalizedData.update({
      where: { id },
      data: filteredData,
    });

    return res.json({ success: true, data: updated });
      }),
);
router.patch(
  '/batches/:id/normalized',
  asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
    const { id } = req.params;
    const changes = Array.isArray(req.body?.changes) ? req.body.changes : [];

    if (!id) {
      return res.status(400).json({ success: false, message: 'Debe especificarse un ID de lote' });
    }

    if (changes.length === 0) {
      return res.status(400).json({ success: false, message: 'No se enviaron cambios' });
    }

    const actor = getRequestActor(req);

    const changeIds = changes
      .map((item: { id?: unknown }) => (typeof item?.id === 'string' ? item.id : null))
      .filter(Boolean) as string[];

    const existingRows = await prisma.normalizedData.findMany({
      where: {
        id: { in: changeIds },
      },
    });

    const existingMap = existingRows.reduce<Record<string, typeof existingRows[number]>>((acc, row) => {
      acc[row.id] = row;
      return acc;
    }, {});

    const updatedRows = [] as typeof existingRows;

    for (const change of changes) {
      const rowId = typeof change?.id === 'string' ? change.id : null;
      const updates = typeof change?.updates === 'object' && change?.updates !== null ? change.updates : null;

      if (!rowId || !updates) {
        continue;
      }

      const before = existingMap[rowId];
      if (!before || before.batchId !== id) {
        continue;
      }

      const after = await prisma.normalizedData.update({
        where: { id: rowId },
        data: updates as any,
      });

      updatedRows.push(after);

      await logAuditEvent(
        {
          action: 'CODIFICATION_ROW_UPDATED',
          entityType: 'normalizedData',
          entityId: rowId,
          description: `Fila actualizada en lote ${id}`,
          before,
          after,
          metadata: {
            batchId: id,
            changedFields: Object.keys(updates),
          },
        },
        actor,
      );
    }

    return res.json({
      success: true,
      message: 'Cambios aplicados',
      data: {
        updated: updatedRows.length,
      },
    });
  }),
);

export const codificationRouter = router;
