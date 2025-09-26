import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';
import { CsvParser } from '../utils/csvParser';
import { DataNormalizer } from '../utils/dataNormalizer';
import { asyncHandler } from '../middleware/errorHandler';
import { env } from '../utils/env';

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
    cb(allowedExtensions.includes(ext) ? null : new Error('Solo se permiten archivos CSV y XLSX'));
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
  upload.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
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

          await prisma.normalizedData.createMany({
            data: rows.map((row) => ({
              batchId: batch.id,
              ...DataNormalizer.normalizeRow(row),
            })),
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

      res.json({
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

    res.json({
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
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

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

    res.json({ success: true, data: batch });
  }),
);

router.get(
  '/batches/:id/staging',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
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

    res.json({
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
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
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

    res.json({
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

export default router;
