import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

async function run() {
  try {
    logger.info('Iniciando seed del servicio de codificación...');

    const exampleBatch = await prisma.importBatch.create({
      data: {
        filename: 'ejemplo-importacion.csv',
        status: 'COMPLETED',
        totalRows: 0,
        processedRows: 0,
        errorRows: 0,
        completedAt: new Date()
      }
    });

    logger.info(`Lote de ejemplo creado con ID: ${exampleBatch.id}`);

    logger.info('Seed completado exitosamente');
  } catch (error) {
    logger.error('Error durante el seed:', error);
    throw error;
  }
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
