import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../../../shared/db/prisma';
import { logger } from '../../../shared/utils/logger';
import { NormaMinsalCsvParser } from '../utils/csvParser';
import { NormaMinsalExcelParser } from '../utils/excelParser';
import { NormaMinsalDataNormalizer } from '../utils/dataNormalizer';
import { asyncHandler } from '../../../shared/middleware/errorHandler';
import { env } from '../../../config/env';
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
    cb(null, `normaminsal-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: env.maxFileSize },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = ['.csv', '.xlsx', '.xls'];
    if (allowedExtensions.includes(ext)) {
      return cb(null, true);
    }
    return cb(new Error('Solo se permiten archivos CSV o Excel (.xlsx, .xls)'));
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
  '/import/csv',
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    const actor = getRequestActor(req);
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No se proporcionó ningún archivo' });
    }

    const { path: filePath, originalname: filename } = req.file;
    const { description } = req.body;
    let fileId: string | null = null;
    let processedRows = 0;
    let errorRows = 0;

    logger.info(`Importando archivo de Norma Minsal: ${filename}`);

    try {
      const file = await prisma.normaMinsalFile.create({
        data: {
          filename,
          description: description || null,
          status: 'PROCESSING',
        },
      });

      fileId = file.id;

      // Determine file type and parse accordingly
      const ext = path.extname(filename).toLowerCase();
      let parseResult;

      if (ext === '.csv') {
        parseResult = await NormaMinsalCsvParser.parseFile(filePath);
      } else if (['.xlsx', '.xls'].includes(ext)) {
        parseResult = await NormaMinsalExcelParser.parseFile(filePath);
      } else {
        throw new Error('Formato de archivo no soportado');
      }

      if (parseResult.errors.length > 0) {
        logger.warn(`Errores durante el parseo: ${parseResult.errors.join(', ')}`);
      }

      await prisma.normaMinsalFile.update({
        where: { id: file.id },
        data: { totalRows: parseResult.totalRows },
      });

      const batchSize = 100;

      for (let index = 0; index < parseResult.rows.length; index += batchSize) {
        const rows = parseResult.rows.slice(index, index + batchSize);

        try {
          const normalizedRows = rows.map((row) => {
            const normalized = NormaMinsalDataNormalizer.normalizeRow(row);
            return {
              fileId: file.id,
              grd: normalized.grd,
              tipoGrd: normalized.tipoGrd ?? null,
              gravedad: normalized.gravedad ?? null,
              totalAltas: normalized.totalAltas ?? null,
              totalEst: normalized.totalEst ?? null,
              estMedia: normalized.estMedia ?? null,
              altasDepu: normalized.altasDepu ?? null,
              totalEstDepu: normalized.totalEstDepu ?? null,
              estMediaDepuG: normalized.estMediaDepuG ?? null,
              numOutInfG: normalized.numOutInfG ?? null,
              nOutliersSup: normalized.nOutliersSup ?? null,
              exitus: normalized.exitus ?? null,
              percentil25: normalized.percentil25 ?? null,
              percentil50: normalized.percentil50 ?? null,
              percentil75: normalized.percentil75 ?? null,
              puntoCorteInferior: normalized.puntoCorteInferior ?? null,
              puntoCorteSuperior: normalized.puntoCorteSuperior ?? null,
              pesoTotal: normalized.pesoTotal ?? null,
              pesoTotalDepu: normalized.pesoTotalDepu ?? null,
              rawData: normalized.rawData,
            };
          });

          await prisma.normaMinsalData.createMany({
            data: normalizedRows,
          });

          processedRows += rows.length;

          await prisma.normaMinsalFile.update({
            where: { id: file.id },
            data: { processedRows },
          });

          logger.info(`Procesadas ${processedRows}/${parseResult.totalRows} filas de Norma Minsal`);
        } catch (error) {
          logger.error(`Error procesando filas ${index + 1}-${index + rows.length}`, error);
          errorRows += rows.length;
        }
      }

      const status = errorRows > 0 ? 'PARTIALLY_COMPLETED' : 'COMPLETED';

      await prisma.normaMinsalFile.update({
        where: { id: file.id },
        data: {
          status,
          errorRows,
          completedAt: new Date(),
        },
      });

      await logAuditEvent(
        {
          action: 'NORMA_IMPORT_COMPLETED',
          entityType: 'normaMinsalFile',
          entityId: file.id,
          description: `Importación de Norma Minsal ${filename} finalizada con estado ${status}`,
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
        message: 'Importación de Norma Minsal completada',
        data: {
          fileId: file.id,
          totalRows: parseResult.totalRows,
          processedRows,
          errorRows,
          status,
          parseErrors: parseResult.errors,
        },
      });
    } catch (error) {
      logger.error('Error durante la importación de Norma Minsal', error);

      if (fileId) {
        await prisma.normaMinsalFile.update({
          where: { id: fileId },
          data: { status: 'FAILED' },
        });

        await logAuditEvent(
          {
            action: 'NORMA_IMPORT_FAILED',
            entityType: 'normaMinsalFile',
            entityId: fileId,
            description: `Importación de Norma Minsal ${filename} falló`,
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
  '/import/batches',
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, skip } = getPagination(req, 10);

    const [files, total] = await Promise.all([
      prisma.normaMinsalFile.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              data: true,
            },
          },
        },
      }),
      prisma.normaMinsalFile.count(),
    ]);

    return res.json({
      success: true,
      data: {
        files,
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
  '/import/batches/:id',
  asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ success: false, message: 'Debe especificarse un ID de lote' });
    }

    const file = await prisma.normaMinsalFile.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            data: true,
          },
        },
      },
    });

    if (!file) {
      return res.status(404).json({ success: false, message: 'Lote no encontrado' });
    }

    return res.json({ success: true, data: file });
  }),
);

router.patch(
  '/import/batches/:id/activate',
  asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
    const { id } = req.params;
    const actor = getRequestActor(req);

    if (!id) {
      return res.status(400).json({ success: false, message: 'Debe especificarse un ID de lote' });
    }

    const file = await prisma.normaMinsalFile.findUnique({
      where: { id },
    });

    if (!file) {
      return res.status(404).json({ success: false, message: 'Lote no encontrado' });
    }

    await prisma.normaMinsalFile.updateMany({
      data: { isActive: false },
    });

    await prisma.normaMinsalFile.update({
      where: { id },
      data: { isActive: true },
    });

    logger.info(`Lote de Norma Minsal ${id} activado`);

    await logAuditEvent(
      {
        action: 'NORMA_BATCH_ACTIVATED',
        entityType: 'normaMinsalFile',
        entityId: id,
        description: 'Lote de Norma Minsal activado',
      },
      actor,
    );

    return res.json({
      success: true,
      message: 'Lote activado correctamente',
      data: { batchId: id },
    });
  }),
);

router.get(
  '/import/active-batch',
  asyncHandler(async (req: Request, res: Response) => {
    const activeFile = await prisma.normaMinsalFile.findFirst({
      where: { isActive: true },
      include: {
        _count: {
          select: {
            data: true,
          },
        },
      },
    });

    if (!activeFile) {
      return res.status(404).json({ success: false, message: 'No hay lote activo' });
    }

    return res.json({ success: true, data: activeFile });
  }),
);

router.get(
  '/import/batches/:id/data',
  asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ success: false, message: 'Debe especificarse un ID de lote' });
    }

    const { page, limit, skip } = getPagination(req, 100);

    const [data, total] = await Promise.all([
      prisma.normaMinsalData.findMany({
        where: { fileId: id },
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
      }),
      prisma.normaMinsalData.count({
        where: { fileId: id },
      }),
    ]);

    return res.json({
      success: true,
      data: {
        data,
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
  '/import/query/grd/:grdCode',
  asyncHandler(async (req: Request<{ grdCode: string }>, res: Response) => {
    const { grdCode } = req.params;
    const { fileId, gravedad } = req.query;

    if (!grdCode) {
      return res.status(400).json({ success: false, message: 'Debe especificarse un código GRD' });
    }

    let targetFileId: string | undefined;

    if (fileId && typeof fileId === 'string') {
      targetFileId = fileId;
    } else {
      const activeFile = await prisma.normaMinsalFile.findFirst({
        where: { isActive: true },
      });

      if (!activeFile) {
        return res.status(404).json({ success: false, message: 'No hay lote activo configurado' });
      }

      targetFileId = activeFile.id;
    }

    const whereClause: {
      fileId: string;
      grd: string;
      gravedad?: string;
    } = {
      fileId: targetFileId,
      grd: grdCode,
    };

    if (gravedad && typeof gravedad === 'string') {
      whereClause.gravedad = gravedad;
    }

    const data = await prisma.normaMinsalData.findFirst({
      where: whereClause,
      include: {
        file: {
          select: {
            id: true,
            filename: true,
            description: true,
          },
        },
      },
    });

    if (!data) {
      return res.status(404).json({
        success: false,
        message: `No se encontró información para el GRD ${grdCode}${gravedad ? ` con gravedad ${gravedad}` : ''}`,
      });
    }

    return res.json({ success: true, data });
  }),
);

router.get(
  '/import/query/grd/:grdCode/all',
  asyncHandler(async (req: Request<{ grdCode: string }>, res: Response) => {
    const { grdCode } = req.params;
    const { fileId } = req.query;

    if (!grdCode) {
      return res.status(400).json({ success: false, message: 'Debe especificarse un código GRD' });
    }

    let targetFileId: string | undefined;

    if (fileId && typeof fileId === 'string') {
      targetFileId = fileId;
    } else {
      const activeFile = await prisma.normaMinsalFile.findFirst({
        where: { isActive: true },
      });

      if (!activeFile) {
        return res.status(404).json({ success: false, message: 'No hay lote activo configurado' });
      }

      targetFileId = activeFile.id;
    }

    const data = await prisma.normaMinsalData.findMany({
      where: {
        fileId: targetFileId,
        grd: grdCode,
      },
      include: {
        file: {
          select: {
            id: true,
            filename: true,
            description: true,
          },
        },
      },
      orderBy: {
        gravedad: 'asc',
      },
    });

    if (data.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No se encontró información para el GRD ${grdCode}`,
      });
    }

    return res.json({ success: true, data, count: data.length });
  }),
);

router.delete(
  '/import/batches/:id',
  asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
    const { id } = req.params;
    const actor = getRequestActor(req);

    if (!id) {
      return res.status(400).json({ success: false, message: 'Debe especificarse un ID de lote' });
    }

    const file = await prisma.normaMinsalFile.findUnique({
      where: { id },
    });

    if (!file) {
      return res.status(404).json({ success: false, message: 'Lote no encontrado' });
    }

    await prisma.normaMinsalFile.delete({
      where: { id },
    });

    logger.info(`Lote de Norma Minsal ${id} eliminado`);

    await logAuditEvent(
      {
        action: 'NORMA_BATCH_DELETED',
        entityType: 'normaMinsalFile',
        entityId: id,
        description: 'Lote de Norma Minsal eliminado',
      },
      actor,
    );

    return res.json({
      success: true,
      message: 'Lote eliminado correctamente',
    });
  }),
);

export const normaMinsalRouter = router;
