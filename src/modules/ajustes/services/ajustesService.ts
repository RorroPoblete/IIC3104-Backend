import { prisma } from '../../../shared/db/prisma';
import { logger } from '../../../shared/utils/logger';
import { Prisma } from '@prisma/client';

export class AjustesService {
  /**
   * Busca ajustes por tecnología basado en códigos de procedimiento
   * @param codigosProcedimiento - Array de códigos de procedimiento a buscar
   * @returns Suma total de ajustes encontrados
   */
  static async buscarAjustesPorCodigos(
    codigosProcedimiento: string[],
  ): Promise<number> {
    if (!codigosProcedimiento || codigosProcedimiento.length === 0) {
      return 0;
    }

    try {
      // Obtener archivo activo de ajustes
      const archivoActivo = await prisma.ajustesTecnologiaFile.findFirst({
        where: { isActive: true, status: 'COMPLETED' },
      });

      if (!archivoActivo) {
        logger.warn('No hay archivo activo de ajustes por tecnología');
        return 0;
      }

      // Buscar ajustes que coincidan con los códigos
      // Los códigos pueden venir separados por ; en el campo codigo
      const codigosLimpios = codigosProcedimiento.map((c) => c.trim()).filter((c) => c !== '');
      
      logger.info('Buscando ajustes por códigos', {
        fileId: archivoActivo.id,
        totalCodigos: codigosLimpios.length,
        codigos: codigosLimpios.slice(0, 10), // Log primeros 10
      });
      
      const ajustes = await prisma.ajustesTecnologiaData.findMany({
        where: {
          fileId: archivoActivo.id,
          OR: codigosLimpios.flatMap((codigo) => [
            // Coincidencia exacta
            { codigo: codigo },
            // Coincidencia cuando el código está al inicio de una lista separada por ;
            { codigo: { startsWith: `${codigo};` } },
            // Coincidencia cuando el código está en medio de una lista
            { codigo: { contains: `;${codigo};` } },
            // Coincidencia cuando el código está al final de una lista
            { codigo: { endsWith: `;${codigo}` } },
          ]),
        },
      });

      logger.info('Resultados de búsqueda de ajustes', {
        totalAjustesEncontrados: ajustes.length,
        ajustesDetalle: ajustes.slice(0, 5).map((a) => ({
          codigo: a.codigo,
          monto: Number(a.monto),
          descripcion: a.descripcion,
        })),
      });

      // Calcular suma total
      const total = ajustes.reduce((sum, ajuste) => {
        return sum + Number(ajuste.monto);
      }, 0);

      logger.info(`Ajustes por tecnología encontrados: ${ajustes.length}, Total: ${total}`);

      return total;
    } catch (error) {
      logger.error('Error al buscar ajustes por tecnología', error);
      return 0;
    }
  }

  /**
   * Busca ajustes por tecnología basado en códigos de procedimiento del episodio
   * @param proced01Principal - Código de procedimiento principal
   * @param conjuntoProcedimientosSecundarios - Conjunto de códigos secundarios (puede venir como [XX.XX][YY.YY] o separados por ;)
   * @returns Suma total de ajustes encontrados
   */
  static async buscarAjustesPorEpisodio(
    proced01Principal?: string | null,
    conjuntoProcedimientosSecundarios?: string | null,
  ): Promise<number> {
    const codigos: string[] = [];

    // Agregar código principal si existe
    if (proced01Principal && proced01Principal.trim() !== '') {
      codigos.push(proced01Principal.trim());
    }

    // Agregar códigos secundarios si existen
    if (conjuntoProcedimientosSecundarios && conjuntoProcedimientosSecundarios.trim() !== '') {
      const conjuntoStr = conjuntoProcedimientosSecundarios.trim();
      
      // Extraer códigos de formato [XX.XX][YY.YY]...
      const codigosConCorchetes = conjuntoStr.match(/\[([^\]]+)\]/g);
      if (codigosConCorchetes && codigosConCorchetes.length > 0) {
        // Extraer el contenido dentro de los corchetes
        const codigosExtraidos = codigosConCorchetes.map((cod) => {
          const match = cod.match(/\[([^\]]+)\]/);
          return match && match[1] ? match[1].trim() : null;
        }).filter((c): c is string => c !== null && c !== '');
        codigos.push(...codigosExtraidos);
      } else {
        // Si no tiene corchetes, intentar separar por ;
        const codigosSecundarios = conjuntoStr
          .split(';')
          .map((c) => c.trim())
          .filter((c) => c !== '');
        codigos.push(...codigosSecundarios);
      }
    }

    if (codigos.length === 0) {
      logger.info('No se encontraron códigos de procedimiento para buscar ajustes');
      return 0;
    }

    logger.info('Buscando ajustes por tecnología', {
      proced01Principal,
      totalCodigos: codigos.length,
      codigos: codigos.slice(0, 10), // Log solo los primeros 10 para no saturar
    });

    return this.buscarAjustesPorCodigos(codigos);
  }
}

