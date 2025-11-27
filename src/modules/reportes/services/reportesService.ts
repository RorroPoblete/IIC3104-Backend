import { prisma } from '../../../shared/db/prisma';
import { logger } from '../../../shared/utils/logger';

export class ReportesService {
  /**
   * Obtiene estadísticas generales del sistema
   */
  async getEstadisticasGenerales() {
    try {
      const [
        totalEpisodios,
        totalImportBatches,
        totalNormaFiles,
        totalPricingFiles,
        totalAjustesFiles,
        totalCalculos,
        totalAuditorias,
      ] = await Promise.all([
        prisma.normalizedData.count(),
        prisma.importBatch.count(),
        prisma.normaMinsalFile.count(),
        prisma.pricingFile.count(),
        prisma.ajustesTecnologiaFile.count(),
        prisma.calculoEpisodio.count(),
        prisma.auditLog.count(),
      ]);

      return {
        totalEpisodios,
        totalImportBatches,
        totalNormaFiles,
        totalPricingFiles,
        totalAjustesFiles,
        totalCalculos,
        totalAuditorias,
      };
    } catch (error) {
      logger.error('Error obteniendo estadísticas generales', error);
      throw error;
    }
  }

  /**
   * Obtiene distribución de episodios por GRD (top 10)
   */
  async getDistribucionPorGRD(limit = 10) {
    try {
      const result = await prisma.normalizedData.groupBy({
        by: ['irGrd'],
        _count: {
          id: true,
        },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
        take: limit,
        where: {
          irGrd: {
            not: null,
          },
        },
      });

      return result.map((item) => ({
        grd: item.irGrd || 'Sin GRD',
        cantidad: item._count?.id || 0,
      }));
    } catch (error) {
      logger.error('Error obteniendo distribución por GRD', error);
      throw error;
    }
  }

  /**
   * Obtiene distribución de episodios por convenio (top 10)
   */
  async getDistribucionPorConvenio(limit = 10) {
    try {
      const result = await prisma.normalizedData.groupBy({
        by: ['conveniosCod'],
        _count: {
          id: true,
        },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
        take: limit,
        where: {
          conveniosCod: {
            not: null,
          },
        },
      });

      return result.map((item) => ({
        convenio: item.conveniosCod || 'Sin Convenio',
        cantidad: item._count?.id || 0,
      }));
    } catch (error) {
      logger.error('Error obteniendo distribución por convenio', error);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas de cálculos realizados
   */
  async getEstadisticasCalculos() {
    try {
      const [totalCalculos, calculosPorConvenio, promedioTotalFinal] = await Promise.all([
        prisma.calculoEpisodio.count(),
        prisma.calculoEpisodio.groupBy({
          by: ['convenio'],
          _count: {
            id: true,
          },
          orderBy: {
            _count: {
              id: 'desc',
            },
          },
          take: 10,
          where: {
            convenio: {
              not: null,
            },
          },
        }),
        prisma.calculoEpisodio.aggregate({
          _avg: {
            totalFinal: true,
          },
        }),
      ]);

      return {
        totalCalculos,
        calculosPorConvenio: calculosPorConvenio.map((item) => ({
          convenio: item.convenio || 'Sin Convenio',
          cantidad: item._count?.id || 0,
        })),
        promedioTotalFinal: promedioTotalFinal._avg.totalFinal?.toNumber() || 0,
      };
    } catch (error) {
      logger.error('Error obteniendo estadísticas de cálculos', error);
      throw error;
    }
  }

  /**
   * Obtiene actividad reciente del sistema (últimas auditorías)
   */
  async getActividadReciente(limit = 10) {
    try {
      const auditorias = await prisma.auditLog.findMany({
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          action: true,
          entityType: true,
          userEmail: true,
          userName: true,
          description: true,
          createdAt: true,
        },
      });

      return auditorias;
    } catch (error) {
      logger.error('Error obteniendo actividad reciente', error);
      throw error;
    }
  }

  /**
   * Obtiene distribución de episodios por edad (rangos)
   */
  async getDistribucionPorEdad() {
    try {
      const episodios = await prisma.normalizedData.findMany({
        where: {
          edadAnos: {
            not: null,
          },
        },
        select: {
          edadAnos: true,
        },
      });

      const rangos = {
        '0-17': 0,
        '18-30': 0,
        '31-45': 0,
        '46-60': 0,
        '61-75': 0,
        '76+': 0,
      };

      episodios.forEach((ep) => {
        const edad = ep.edadAnos!;
        if (edad <= 17) rangos['0-17']++;
        else if (edad <= 30) rangos['18-30']++;
        else if (edad <= 45) rangos['31-45']++;
        else if (edad <= 60) rangos['46-60']++;
        else if (edad <= 75) rangos['61-75']++;
        else rangos['76+']++;
      });

      return Object.entries(rangos).map(([rango, cantidad]) => ({
        rango,
        cantidad,
      }));
    } catch (error) {
      logger.error('Error obteniendo distribución por edad', error);
      throw error;
    }
  }

  /**
   * Obtiene distribución de episodios por sexo
   */
  async getDistribucionPorSexo() {
    try {
      const result = await prisma.normalizedData.groupBy({
        by: ['sexo'],
        _count: {
          id: true,
        },
        where: {
          sexo: {
            not: null,
          },
        },
      });

      return result.map((item) => ({
        sexo: item.sexo || 'No especificado',
        cantidad: item._count?.id || 0,
      }));
    } catch (error) {
      logger.error('Error obteniendo distribución por sexo', error);
      throw error;
    }
  }

  /**
   * Obtiene tendencia de importaciones por mes (últimos 6 meses)
   */
  async getTendenciaImportaciones() {
    try {
      const seisMesesAtras = new Date();
      seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 6);

      const importaciones = await prisma.importBatch.findMany({
        where: {
          createdAt: {
            gte: seisMesesAtras,
          },
        },
        select: {
          createdAt: true,
          totalRows: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      // Agrupar por mes
      const porMes: Record<string, { mes: string; cantidad: number; totalRows: number }> = {};

      importaciones.forEach((imp) => {
        const mes = imp.createdAt.toISOString().substring(0, 7); // YYYY-MM
        if (!porMes[mes]) {
          porMes[mes] = { mes, cantidad: 0, totalRows: 0 };
        }
        porMes[mes].cantidad++;
        porMes[mes].totalRows += imp.totalRows || 0;
      });

      return Object.values(porMes);
    } catch (error) {
      logger.error('Error obteniendo tendencia de importaciones', error);
      throw error;
    }
  }
}

