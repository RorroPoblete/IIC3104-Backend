import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../../../shared/db/prisma';
import { logger } from '../../../shared/utils/logger';
import { AjustesTecnologiaExcelParser } from '../utils/excelParser';
import { AjustesTecnologiaDataNormalizer } from '../utils/dataNormalizer';
import { asyncHandler } from '../../../shared/middleware/errorHandler';
import { env } from '../../../config/env';
import { Prisma } from '@prisma/client';

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
    cb(null, `ajustes-tecnologia-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: env.maxFileSize },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = ['.xlsx', '.xls'];
    if (allowedExtensions.includes(ext)) {
      return cb(null, true);
    }
    return cb(new Error('Solo se permiten archivos Excel (.xlsx, .xls)'));
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
  '/import/excel',
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No se proporcionó ningún archivo' });
    }

    const { path: filePath, originalname: filename } = req.file;
    const { description } = req.body;
    let fileId: string | null = null;
    let processedRows = 0;
    let errorRows = 0;

    logger.info(`Importando archivo de Ajustes por Tecnología: ${filename}`);

    try {
      const file = await prisma.ajustesTecnologiaFile.create({
        data: {
          filename,
          description: description || null,
          status: 'PROCESSING',
        },
      });

      fileId = file.id;

      const ext = path.extname(filename).toLowerCase();
      if (!['.xlsx', '.xls'].includes(ext)) {
        throw new Error('Formato de archivo no soportado. Solo se permiten archivos Excel');
      }

      const parseResult = await AjustesTecnologiaExcelParser.parseFile(filePath);

      if (parseResult.errors.length > 0) {
        logger.warn(`Errores durante el parseo: ${parseResult.errors.join(', ')}`);
      }

      await prisma.ajustesTecnologiaFile.update({
        where: { id: file.id },
        data: { totalRows: parseResult.totalRows },
      });

      const batchSize = 100;

      for (let index = 0; index < parseResult.rows.length; index += batchSize) {
        const rows = parseResult.rows.slice(index, index + batchSize);

        try {
          const normalizedRows = rows.map((row) => {
            const normalized = AjustesTecnologiaDataNormalizer.normalizeRow(row);
            return {
              fileId: file.id,
              codigo: normalized.codigo,
              descripcion: normalized.descripcion ?? null,
              monto: new Prisma.Decimal(normalized.monto),
              rawData: normalized.rawData,
            };
          });

          await prisma.ajustesTecnologiaData.createMany({
            data: normalizedRows,
          });

          processedRows += rows.length;

          await prisma.ajustesTecnologiaFile.update({
            where: { id: file.id },
            data: { processedRows },
          });

          logger.info(`Procesadas ${processedRows}/${parseResult.totalRows} filas de Ajustes por Tecnología`);
        } catch (error) {
          logger.error(`Error procesando filas ${index + 1}-${index + rows.length}`, error);
          errorRows += rows.length;
        }
      }

      const status = errorRows > 0 ? 'PARTIALLY_COMPLETED' : 'COMPLETED';

      await prisma.ajustesTecnologiaFile.update({
        where: { id: file.id },
        data: {
          status,
          errorRows,
          completedAt: new Date(),
        },
      });

      return res.json({
        success: true,
        message: 'Importación de Ajustes por Tecnología completada',
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
      logger.error('Error durante la importación de Ajustes por Tecnología', error);

      if (fileId) {
        await prisma.ajustesTecnologiaFile.update({
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

router.get(
  '/import/files',
  asyncHandler(async (req: Request, res: Response) => {
    const { page, limit, skip } = getPagination(req, 10);

    const [files, total] = await Promise.all([
      prisma.ajustesTecnologiaFile.findMany({
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
      prisma.ajustesTecnologiaFile.count(),
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
  '/import/files/:id',
  asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ success: false, message: 'Debe especificarse un ID de archivo' });
    }

    const file = await prisma.ajustesTecnologiaFile.findUnique({
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
      return res.status(404).json({ success: false, message: 'Archivo no encontrado' });
    }

    return res.json({ success: true, data: file });
  }),
);

router.patch(
  '/import/files/:id/activate',
  asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ success: false, message: 'Debe especificarse un ID de archivo' });
    }

    const file = await prisma.ajustesTecnologiaFile.findUnique({
      where: { id },
    });

    if (!file) {
      return res.status(404).json({ success: false, message: 'Archivo no encontrado' });
    }

    // Desactivar todos los archivos
    await prisma.ajustesTecnologiaFile.updateMany({
      data: { isActive: false },
    });

    // Activar el archivo seleccionado
    await prisma.ajustesTecnologiaFile.update({
      where: { id },
      data: { isActive: true },
    });

    logger.info(`Archivo de Ajustes por Tecnología ${id} activado`);

    return res.json({
      success: true,
      message: 'Archivo activado correctamente',
      data: { fileId: id },
    });
  }),
);

router.get(
  '/import/active',
  asyncHandler(async (req: Request, res: Response) => {
    const activeFile = await prisma.ajustesTecnologiaFile.findFirst({
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
      return res.status(404).json({ success: false, message: 'No hay archivo activo' });
    }

    return res.json({ success: true, data: activeFile });
  }),
);

router.get(
  '/import/files/:id/data',
  asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ success: false, message: 'Debe especificarse un ID de archivo' });
    }

    const { page, limit, skip } = getPagination(req, 100);

    const [data, total] = await Promise.all([
      prisma.ajustesTecnologiaData.findMany({
        where: { fileId: id },
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
      }),
      prisma.ajustesTecnologiaData.count({
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

router.delete(
  '/import/files/:id',
  asyncHandler(async (req: Request<{ id: string }>, res: Response) => {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ success: false, message: 'Debe especificarse un ID de archivo' });
    }

    const file = await prisma.ajustesTecnologiaFile.findUnique({
      where: { id },
    });

    if (!file) {
      return res.status(404).json({ success: false, message: 'Archivo no encontrado' });
    }

    await prisma.ajustesTecnologiaFile.delete({
      where: { id },
    });

    logger.info(`Archivo de Ajustes por Tecnología ${id} eliminado`);

    return res.json({
      success: true,
      message: 'Archivo eliminado correctamente',
    });
  }),
);

export const ajustesRouter = router;

