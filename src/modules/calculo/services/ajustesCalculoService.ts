import { logger } from '../../../shared/utils/logger';
import { AjustesService } from '../../ajustes/services/ajustesService';
import { prisma } from '../../../shared/db/prisma';

export interface AjustesCalculoResult {
  ajustesTecnologia: number;
  diasEspera: number;
  outlierSuperior: number;
  totalAjustes: number;
}

/**
 * Servicio para calcular ajustes adicionales al precio base
 */
export class AjustesCalculoService {
  // Montos de días de espera para convenio CH0041 según vigencia
  private static readonly MONTOS_DIAS_ESPERA_CH0041 = [
    {
      desde: new Date('2023-01-01'),
      hasta: new Date('2024-08-28'),
      monto: 95000,
    },
    {
      desde: new Date('2024-08-29'),
      hasta: new Date('2025-08-28'),
      monto: 98990,
    },
    {
      desde: new Date('2025-08-29'),
      hasta: new Date('2025-12-31'),
      monto: 102455,
    },
  ];

  /**
   * Calcula ajustes por tecnología basado en códigos de procedimiento del episodio
   */
  static async calcularAjustesTecnologia(
    proced01Principal?: string | null,
    conjuntoProcedimientosSecundarios?: string | null,
  ): Promise<number> {
    try {
      const ajustes = await AjustesService.buscarAjustesPorEpisodio(
        proced01Principal,
        conjuntoProcedimientosSecundarios,
      );

      logger.info('Ajustes por tecnología calculados', {
        proced01Principal,
        conjuntoProcedimientosSecundarios,
        ajustes,
      });

      return ajustes;
    } catch (error) {
      logger.error('Error al calcular ajustes por tecnología', error);
      return 0;
    }
  }

  /**
   * Calcula pago por días de espera según convenio y vigencia
   * @param convenioId - Código del convenio (CH0041 o FNS012)
   * @param diasEspera - Número de días de espera
   * @param fechaReferencia - Fecha de referencia para determinar vigencia
   * @returns Monto calculado por días de espera
   */
  static calcularDiasEspera(
    convenioId: string,
    diasEspera: number | null | undefined,
    fechaReferencia?: Date | string | null,
  ): number {
    if (!diasEspera || diasEspera <= 0) {
      return 0;
    }

    const convenio = convenioId.trim().toUpperCase();

    // Convenio CH0041: Días de espera * Monto día espera (según vigencia)
    if (convenio === 'CH0041') {
      const fecha = fechaReferencia ? new Date(fechaReferencia) : new Date();

      // Buscar monto según vigencia
      const montoVigente = AjustesCalculoService.MONTOS_DIAS_ESPERA_CH0041.find(
        (periodo) => fecha >= periodo.desde && fecha <= periodo.hasta,
      );

      if (!montoVigente) {
        logger.warn('No se encontró monto vigente para días de espera CH0041', {
          fecha: fecha.toISOString(),
        });
        // Usar el último monto disponible como fallback
        const ultimoMonto =
          AjustesCalculoService.MONTOS_DIAS_ESPERA_CH0041[
            AjustesCalculoService.MONTOS_DIAS_ESPERA_CH0041.length - 1
          ];
        if (!ultimoMonto) {
          logger.error('No hay montos disponibles para días de espera CH0041');
          return 0;
        }
        return diasEspera * ultimoMonto.monto;
      }

      const total = diasEspera * montoVigente.monto;

      logger.info('Días de espera calculados para CH0041', {
        convenioId,
        diasEspera,
        montoPorDia: montoVigente.monto,
        total,
        fechaReferencia: fecha.toISOString(),
      });

      return total;
    }

    // Convenio FNS012: Total días demora en rescate
    // TODO: Necesitamos determinar el monto para FNS012
    // Por ahora retornamos 0 hasta tener más información
    if (convenio === 'FNS012') {
      logger.warn('Cálculo de días de espera para FNS012 no implementado aún');
      return 0;
    }

    return 0;
  }

  /**
   * Calcula pago por outlier superior (solo para convenio FNS012)
   * @param convenioId - Código del convenio
   * @param ir - Peso relativo/IR del episodio
   * @param puntoCorteSuperior - Punto de corte superior de la norma
   * @param precioBase - Precio base del episodio (necesario para calcular el monto)
   * @returns Monto calculado por outlier superior
   */
  static calcularOutlierSuperior(
    convenioId: string,
    ir: number,
    puntoCorteSuperior: number | null | undefined,
    precioBase?: number,
  ): number {
    const convenio = convenioId.trim().toUpperCase();

    // Solo aplica para FNS012
    if (convenio !== 'FNS012') {
      return 0;
    }

    // Validar que tenemos punto de corte superior
    if (!puntoCorteSuperior || puntoCorteSuperior <= 0) {
      return 0;
    }

    // Determinar si es outlier superior: IR > puntoCorteSuperior
    const esOutlierSuperior = ir > puntoCorteSuperior;

    if (!esOutlierSuperior) {
      return 0;
    }

    // Calcular el monto: (IR - puntoCorteSuperior) * precioBase
    // Esto representa el pago por cada unidad de IR que excede el punto de corte
    if (!precioBase || precioBase <= 0) {
      logger.warn('No se puede calcular outlier superior sin precio base', {
        convenioId,
        ir,
        puntoCorteSuperior,
        precioBase,
      });
      return 0;
    }

    const diferenciaIR = ir - puntoCorteSuperior;
    const montoOutlier = diferenciaIR * precioBase;

    logger.info('Outlier superior calculado para FNS012', {
      convenioId,
      ir,
      puntoCorteSuperior,
      diferenciaIR,
      precioBase,
      montoOutlier,
    });

    return montoOutlier;
  }

  /**
   * Calcula todos los ajustes adicionales para un episodio
   */
  static async calcularTodosAjustes(params: {
    convenioId: string;
    ir: number;
    puntoCorteSuperior?: number | null;
    diasEspera?: number | null;
    proced01Principal?: string | null;
    conjuntoProcedimientosSecundarios?: string | null;
    fechaReferencia?: Date | string | null;
    precioBase?: number;
  }): Promise<AjustesCalculoResult> {
    const {
      convenioId,
      ir,
      puntoCorteSuperior,
      diasEspera,
      proced01Principal,
      conjuntoProcedimientosSecundarios,
      fechaReferencia,
      precioBase,
    } = params;

    // Calcular ajustes por tecnología
    const ajustesTecnologia = await this.calcularAjustesTecnologia(
      proced01Principal,
      conjuntoProcedimientosSecundarios,
    );

    // Calcular días de espera
    const diasEsperaCalculo = this.calcularDiasEspera(convenioId, diasEspera, fechaReferencia);

    // Calcular outlier superior (requiere precioBase)
    const outlierSuperior = this.calcularOutlierSuperior(
      convenioId,
      ir,
      puntoCorteSuperior,
      precioBase,
    );

    const totalAjustes = ajustesTecnologia + diasEsperaCalculo + outlierSuperior;

    logger.info('Todos los ajustes calculados', {
      convenioId,
      ajustesTecnologia,
      diasEspera: diasEsperaCalculo,
      outlierSuperior,
      totalAjustes,
    });

    return {
      ajustesTecnologia,
      diasEspera: diasEsperaCalculo,
      outlierSuperior,
      totalAjustes,
    };
  }
}



