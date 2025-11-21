import {
  getPrecioBase,
  PrecioBase,
  GetPrecioBaseParams,
  ConvenioTipo,
  ConvenioNoDisponibleError,
  PesoRelativoInvalidoError,
  TarifaFueraDeVigenciaError,
  TarifaSourceUnavailableError,
  PricingError,
} from '../../../../packages/rules/pricing';
import { logger } from '../../../shared/utils/logger';

export interface CalculatePrecioBaseRequest {
  convenioId: string;
  pesoRelativo: number;
  fechaReferencia?: Date | string;
}

export interface CalculatePrecioBaseResponse {
  convenioId: string;
  tipo: ConvenioTipo;
  valor: number;
  fuente: 'db' | 'attachment';
  tramo?: {
    id: 'T1' | 'T2' | 'T3';
    etiqueta: string;
    min: number;
    max?: number;
    incluyeMin: boolean;
    incluyeMax: boolean;
  };
  tramoId?: 'T1' | 'T2' | 'T3';
  vigencia?: {
    desde?: Date;
    hasta?: Date;
  };
}

export class PricingService {
  /**
   * Calcula el precio base para un convenio y peso relativo dados.
   * 
   * @param params - Parámetros del cálculo
   * @returns Precio base calculado
   * @throws ConvenioNoDisponibleError - Si el convenio no existe en las tarifas
   * @throws PesoRelativoInvalidoError - Si el peso relativo es inválido
   * @throws TarifaFueraDeVigenciaError - Si no hay tarifas vigentes para la fecha
   * @throws TarifaSourceUnavailableError - Si no hay fuentes de tarifas configuradas
   */
  static async calculatePrecioBase(
    params: CalculatePrecioBaseRequest,
  ): Promise<CalculatePrecioBaseResponse> {
    try {
      const precioBaseParams: GetPrecioBaseParams = {
        convenioId: params.convenioId,
        pesoRelativo: params.pesoRelativo,
        preferSource: 'auto', // Intenta BD primero, luego adjunto
      };

      if (params.fechaReferencia) {
        precioBaseParams.fechaReferencia = new Date(params.fechaReferencia);
      }

      const resultado = await getPrecioBase(precioBaseParams);

      return this.mapPrecioBaseToResponse(resultado);
    } catch (error) {
      if (
        error instanceof ConvenioNoDisponibleError ||
        error instanceof PesoRelativoInvalidoError ||
        error instanceof TarifaFueraDeVigenciaError ||
        error instanceof TarifaSourceUnavailableError
      ) {
        logger.warn('[PricingService] Error calculando precio base', {
          error: error.message,
          convenioId: params.convenioId,
          pesoRelativo: params.pesoRelativo,
        });
        throw error;
      }

      logger.error('[PricingService] Error inesperado calculando precio base', {
        error: error instanceof Error ? error.message : String(error),
        convenioId: params.convenioId,
        pesoRelativo: params.pesoRelativo,
      });

      throw new PricingError(
        `Error inesperado al calcular precio base: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private static mapPrecioBaseToResponse(
    precioBase: PrecioBase,
  ): CalculatePrecioBaseResponse {
    const response: CalculatePrecioBaseResponse = {
      convenioId: precioBase.convenioId,
      tipo: precioBase.tipo,
      valor: precioBase.valor,
      fuente: precioBase.fuente,
    };

    if (precioBase.tramo) {
      response.tramo = {
        id: precioBase.tramo.id,
        etiqueta: precioBase.tramo.etiqueta,
        min: precioBase.tramo.min,
        incluyeMin: precioBase.tramo.incluyeMin,
        incluyeMax: precioBase.tramo.incluyeMax,
      };
      
      if (precioBase.tramo.max !== undefined) {
        response.tramo.max = precioBase.tramo.max;
      }
      
      response.tramoId = precioBase.tramo.id;
    }

    if (precioBase.vigencia) {
      response.vigencia = {};
      
      if (precioBase.vigencia.desde !== undefined) {
        response.vigencia.desde = precioBase.vigencia.desde;
      }
      
      if (precioBase.vigencia.hasta !== undefined) {
        response.vigencia.hasta = precioBase.vigencia.hasta;
      }
    }

    return response;
  }
}

