import { prisma } from '../../../shared/db/prisma';
import { logger } from '../../../shared/utils/logger';

export interface NormaMinsalEnrichmentData {
  pesoTotalNorma: number | null;
  pesoTotalDepuNorma: number | null;
  estMediaNorma: number | null;
  gravedadNorma: string | null;
  tieneNorma: boolean;
}

export class NormaMinsalEnricher {
  /**
   * Enriquece un episodio con datos de la Norma MINSAL basándose en el código GRD.
   * 
   * @param grdCode - Código GRD del episodio (puede venir de irGrdCodigo o irGrd)
   * @param gravedad - Gravedad del episodio (opcional, para matching más preciso)
   * @returns Datos enriquecidos de la norma o valores null si no se encuentra
   */
  static async enrichWithNormaMinsal(
    grdCode: string | null | undefined,
    gravedad?: string | null,
  ): Promise<NormaMinsalEnrichmentData> {
    // Si no hay código GRD, retornar valores vacíos
    if (!grdCode || grdCode.trim() === '') {
      return {
        pesoTotalNorma: null,
        pesoTotalDepuNorma: null,
        estMediaNorma: null,
        gravedadNorma: null,
        tieneNorma: false,
      };
    }

    try {
      // Buscar el archivo activo de Norma MINSAL
      const activeFile = await prisma.normaMinsalFile.findFirst({
        where: { isActive: true, status: 'COMPLETED' },
      });

      if (!activeFile) {
        logger.warn('[NormaMinsalEnricher] No hay archivo activo de Norma MINSAL');
        return {
          pesoTotalNorma: null,
          pesoTotalDepuNorma: null,
          estMediaNorma: null,
          gravedadNorma: null,
          tieneNorma: false,
        };
      }

      // Construir la condición de búsqueda
      const whereClause: {
        fileId: string;
        grd: string;
        gravedad?: string;
      } = {
        fileId: activeFile.id,
        grd: grdCode.trim(),
      };

      // Si se proporciona gravedad, intentar matching más preciso
      if (gravedad && gravedad.trim() !== '') {
        whereClause.gravedad = gravedad.trim();
      }

      // Buscar datos de la norma
      let normaData = await prisma.normaMinsalData.findFirst({
        where: whereClause,
      });

      // Si no se encontró con gravedad, intentar sin gravedad
      if (!normaData && gravedad) {
        normaData = await prisma.normaMinsalData.findFirst({
          where: {
            fileId: activeFile.id,
            grd: grdCode.trim(),
          },
        });
      }

      if (!normaData) {
        logger.debug(
          `[NormaMinsalEnricher] No se encontró norma para GRD ${grdCode}${gravedad ? ` con gravedad ${gravedad}` : ''}`,
        );
        return {
          pesoTotalNorma: null,
          pesoTotalDepuNorma: null,
          estMediaNorma: null,
          gravedadNorma: null,
          tieneNorma: false,
        };
      }

      // Retornar datos enriquecidos
      return {
        pesoTotalNorma: normaData.pesoTotal ?? null,
        pesoTotalDepuNorma: normaData.pesoTotalDepu ?? null,
        estMediaNorma: normaData.estMedia ?? null,
        gravedadNorma: normaData.gravedad ?? null,
        tieneNorma: true,
      };
    } catch (error) {
      logger.error('[NormaMinsalEnricher] Error al enriquecer con Norma MINSAL', error);
      return {
        pesoTotalNorma: null,
        pesoTotalDepuNorma: null,
        estMediaNorma: null,
        gravedadNorma: null,
        tieneNorma: false,
      };
    }
  }

  /**
   * Enriquece múltiples episodios en batch para mejor rendimiento.
   * 
   * @param episodes - Array de episodios con código GRD
   * @returns Map con los datos enriquecidos indexados por código GRD
   */
  static async enrichBatch(
    episodes: Array<{ grdCode: string | null | undefined; gravedad?: string | null }>,
  ): Promise<Map<string, NormaMinsalEnrichmentData>> {
    const enrichmentMap = new Map<string, NormaMinsalEnrichmentData>();

    // Obtener códigos GRD únicos
    const uniqueGrdCodes = new Set<string>();
    episodes.forEach((ep) => {
      if (ep.grdCode && ep.grdCode.trim() !== '') {
        uniqueGrdCodes.add(ep.grdCode.trim());
      }
    });

    if (uniqueGrdCodes.size === 0) {
      return enrichmentMap;
    }

    try {
      // Buscar el archivo activo de Norma MINSAL
      const activeFile = await prisma.normaMinsalFile.findFirst({
        where: { isActive: true, status: 'COMPLETED' },
      });

      if (!activeFile) {
        logger.warn('[NormaMinsalEnricher] No hay archivo activo de Norma MINSAL');
        return enrichmentMap;
      }

      // Buscar todos los datos de norma para los GRDs únicos
      const normaDataList = await prisma.normaMinsalData.findMany({
        where: {
          fileId: activeFile.id,
          grd: { in: Array.from(uniqueGrdCodes) },
        },
      });

      // Crear un mapa de GRD -> datos de norma
      // Si hay múltiples registros para el mismo GRD, preferir el que tenga gravedad
      const normaDataMap = new Map<string, typeof normaDataList[0]>();
      
      normaDataList.forEach((data) => {
        const existing = normaDataMap.get(data.grd);
        if (!existing || (data.gravedad && !existing.gravedad)) {
          normaDataMap.set(data.grd, data);
        }
      });

      // Construir el mapa de enriquecimiento
      uniqueGrdCodes.forEach((grdCode) => {
        const normaData = normaDataMap.get(grdCode);
        
        if (normaData) {
          enrichmentMap.set(grdCode, {
            pesoTotalNorma: normaData.pesoTotal ?? null,
            pesoTotalDepuNorma: normaData.pesoTotalDepu ?? null,
            estMediaNorma: normaData.estMedia ?? null,
            gravedadNorma: normaData.gravedad ?? null,
            tieneNorma: true,
          });
        } else {
          enrichmentMap.set(grdCode, {
            pesoTotalNorma: null,
            pesoTotalDepuNorma: null,
            estMediaNorma: null,
            gravedadNorma: null,
            tieneNorma: false,
          });
        }
      });
    } catch (error) {
      logger.error('[NormaMinsalEnricher] Error al enriquecer batch con Norma MINSAL', error);
    }

    return enrichmentMap;
  }
}


