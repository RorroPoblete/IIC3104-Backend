import { Prisma } from '@prisma/client';
import { prisma } from '../../../shared/db/prisma';
import { logger } from '../../../shared/utils/logger';
import { PricingService } from '../../pricing/services/pricingService';
import { calcSubtotal } from '../utils/calcUtils';
import { AjustesCalculoService } from './ajustesCalculoService';
import {
  ConvenioNoDisponibleError,
  PesoRelativoInvalidoError,
  TarifaFueraDeVigenciaError,
  TarifaSourceUnavailableError,
} from '../../../../packages/rules/pricing';

export interface CalculoBreakdown {
  episodioId: string;
  convenio: string | null;
  grd: string | null;
  precioBase: number;
  ir: number;
  subtotal: number;
  ajustes: {
    ajustesTecnologia: number;
    diasEspera: number;
    outlierSuperior: number;
    totalAjustes: number;
  };
  totalFinal: number;
  fuentes: {
    norma: string | null;
    pricing: string | null;
  };
}

export interface CalculoEpisodioParams {
  episodioId: string;
  fechaReferencia?: Date | string;
  usuario?: string;
}

export interface CalculoEpisodioResult {
  calculoId: string;
  version: number;
  breakdown: CalculoBreakdown;
  totalFinal: number;
}

export class CalculoService {
  /**
   * Calcula el precio integral de un episodio (V1)
   * Incluye: Precio Base × IR = Subtotal + Ajustes (Tecnología, Días de Espera, Outlier Superior)
   */
  static async calcularEpisodio(
    params: CalculoEpisodioParams,
  ): Promise<CalculoEpisodioResult> {
    const { episodioId, fechaReferencia, usuario } = params;

    // 1. Cargar episodio normalizado
    const episodio = await prisma.normalizedData.findUnique({
      where: { id: episodioId },
    });

    if (!episodio) {
      throw new Error(`Episodio con id ${episodioId} no encontrado`);
    }

    // 2. Validar que tiene norma
    if (!episodio.tieneNorma) {
      throw new Error(
        `El episodio ${episodioId} no tiene norma MINSAL asociada (tieneNorma === false)`,
      );
    }

    // 3. Determinar convenio del episodio
    const convenioId = episodio.conveniosCod;
    if (!convenioId || convenioId.trim() === '') {
      throw new Error(
        `El episodio ${episodioId} no tiene convenio asociado (conveniosCod vacío)`,
      );
    }

    const convenioIdTrimmed = convenioId.trim();
    logger.info('[CalculoService] Determinando convenio', {
      episodioId,
      convenioIdRaw: convenioId,
      convenioIdTrimmed,
    });

    // 4. Obtener IR a usar (pesoTotalNorma es el campo vigente)
    const ir = episodio.pesoTotalNorma;
    if (!ir || ir <= 0) {
      throw new Error(
        `El episodio ${episodioId} no tiene IR válido (pesoTotalNorma: ${ir})`,
      );
    }

    // 5. Obtener archivos activos para tracking
    const [normaFile, pricingFile] = await Promise.all([
      prisma.normaMinsalFile.findFirst({
        where: { isActive: true, status: 'COMPLETED' },
      }),
      prisma.pricingFile.findFirst({
        where: { isActive: true, status: 'COMPLETED' },
      }),
    ]);

    if (!pricingFile) {
      throw new Error(
        'No hay archivo activo de pricing. Debe activar un archivo de tarifas antes de calcular.',
      );
    }

    // 6. Calcular precio base usando el servicio de Pricing
    let precioBase: number;
    let tramoId: string | undefined;

    try {
      const precioBaseParams: {
        convenioId: string;
        pesoRelativo: number;
        fechaReferencia?: Date | string;
      } = {
        convenioId: convenioIdTrimmed,
        pesoRelativo: ir,
      };

      logger.info('[CalculoService] Calculando precio base', {
        convenioId: convenioIdTrimmed,
        pesoRelativo: ir,
        fechaReferencia: fechaReferencia ? new Date(fechaReferencia).toISOString() : undefined,
      });

      if (fechaReferencia) {
        precioBaseParams.fechaReferencia = new Date(fechaReferencia);
      }

      const precioBaseResult = await PricingService.calculatePrecioBase(precioBaseParams);

      precioBase = precioBaseResult.valor;
      tramoId = precioBaseResult.tramoId;
    } catch (error) {
      if (error instanceof ConvenioNoDisponibleError) {
        logger.error('[CalculoService] Convenio no disponible', {
          episodioId,
          convenioId: convenioIdTrimmed,
          precioFileId: pricingFile.id,
          precioFileName: pricingFile.filename,
        });
        throw new Error(
          `Convenio ${convenioIdTrimmed} no disponible en las tarifas activas. Verifica que el convenio exista en el archivo de pricing activo (${pricingFile.filename})`,
        );
      }
      if (error instanceof PesoRelativoInvalidoError) {
        throw new Error(`IR inválido: ${ir}`);
      }
      if (error instanceof TarifaFueraDeVigenciaError) {
        throw new Error(
          `No hay tarifas vigentes para el convenio ${convenioIdTrimmed} en la fecha de referencia`,
        );
      }
      if (error instanceof TarifaSourceUnavailableError) {
        throw new Error(
          'No hay fuentes de tarifas configuradas. Debe activar un archivo de pricing.',
        );
      }
      throw error;
    }

    // 7. Calcular subtotal
    const subtotal = calcSubtotal(precioBase, ir);

    // 8. Calcular ajustes adicionales
    const ajustes = await AjustesCalculoService.calcularTodosAjustes({
      convenioId: convenioIdTrimmed,
      ir,
      puntoCorteSuperior: episodio.irPuntoCorteSuperior,
      diasEspera: episodio.estanciaEpisodio, // TODO: Verificar si este es el campo correcto para días de espera
      proced01Principal: episodio.proced01Principal,
      conjuntoProcedimientosSecundarios: episodio.conjuntoProcedimientosSecundarios,
      fechaReferencia: fechaReferencia || episodio.fechaIngresoCompleta,
    });

    // 9. Calcular total final: subtotal + ajustes
    const totalFinal = subtotal + ajustes.totalAjustes;

    // 10. Construir breakdown
    const breakdown: CalculoBreakdown = {
      episodioId,
      convenio: convenioIdTrimmed,
      grd: episodio.irGrdCodigo || episodio.irGrd || null,
      precioBase,
      ir,
      subtotal,
      ajustes: {
        ajustesTecnologia: ajustes.ajustesTecnologia,
        diasEspera: ajustes.diasEspera,
        outlierSuperior: ajustes.outlierSuperior,
        totalAjustes: ajustes.totalAjustes,
      },
      totalFinal,
      fuentes: {
        norma: normaFile ? normaFile.filename : null,
        pricing: pricingFile.filename,
      },
    };

    logger.info('[CalculoService] Cálculo completado', {
      episodioId,
      convenio: convenioIdTrimmed,
      precioBase,
      ir,
      subtotal,
      ajustes: ajustes.totalAjustes,
      totalFinal,
      tramo: tramoId,
    });

    // 11. Obtener próxima versión
    const lastVersion = await prisma.calculoEpisodio.findFirst({
      where: { episodioId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    const nextVersion = (lastVersion?.version ?? 0) + 1;

    // 12. Persistir cálculo
    const calculo = await prisma.calculoEpisodio.create({
      data: {
        episodioId,
        version: nextVersion,
        convenio: convenioId.trim(),
        grd: breakdown.grd,
        precioBase: new Prisma.Decimal(precioBase),
        ir: new Prisma.Decimal(ir),
        subtotal: new Prisma.Decimal(subtotal),
        totalFinal: new Prisma.Decimal(totalFinal),
        breakdown: breakdown as unknown as Prisma.JsonObject,
        fechaReferencia: fechaReferencia
          ? new Date(fechaReferencia)
          : null,
        normaFileId: normaFile?.id ?? null,
        pricingFileId: pricingFile.id,
        usuario: usuario ?? null,
      },
    });

    // 13. Registrar auditoría
    await prisma.calculoAuditoria.create({
      data: {
        evento: 'Recalcular episodio (V1)',
        episodioId,
        calculoId: calculo.id,
        usuario: usuario ?? null,
        totalFinal: new Prisma.Decimal(totalFinal),
        fuentes: {
          norma: normaFile ? normaFile.filename : null,
          pricing: pricingFile.filename,
        } as unknown as Prisma.JsonObject,
        metadata: {
          version: nextVersion,
          convenio: convenioId.trim(),
          grd: breakdown.grd,
          tramo: tramoId,
        } as unknown as Prisma.JsonObject,
      },
    });

    logger.info('[CalculoService] Cálculo completado', {
      episodioId,
      version: nextVersion,
      totalFinal,
      convenio: convenioIdTrimmed,
    });

    return {
      calculoId: calculo.id,
      version: nextVersion,
      breakdown,
      totalFinal,
    };
  }

  /**
   * Obtiene el historial de versiones de cálculo para un episodio
   */
  static async getHistorialVersiones(episodioId: string) {
    try {
      const calculos = await prisma.calculoEpisodio.findMany({
        where: { episodioId },
        orderBy: { version: 'desc' },
        select: {
          id: true,
          version: true,
          totalFinal: true,
          createdAt: true,
          usuario: true,
          convenio: true,
          grd: true,
        },
      });

      return calculos.map((calc) => ({
        id: calc.id,
        version: calc.version,
        totalFinal: Number(calc.totalFinal),
        fecha: calc.createdAt,
        usuario: calc.usuario,
        convenio: calc.convenio,
        grd: calc.grd,
      }));
    } catch (error) {
      logger.error('[CalculoService] Error al obtener historial de versiones', {
        episodioId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Obtiene el detalle completo de un cálculo específico
   */
  static async getDetalleCalculo(calculoId: string) {
    const calculo = await prisma.calculoEpisodio.findUnique({
      where: { id: calculoId },
      include: {
        normaFile: {
          select: { id: true, filename: true },
        },
        pricingFile: {
          select: { id: true, filename: true },
        },
      },
    });

    if (!calculo) {
      throw new Error(`Cálculo con id ${calculoId} no encontrado`);
    }

    return {
      id: calculo.id,
      episodioId: calculo.episodioId,
      version: calculo.version,
      breakdown: calculo.breakdown as unknown as CalculoBreakdown,
      totalFinal: Number(calculo.totalFinal),
      fechaReferencia: calculo.fechaReferencia,
      createdAt: calculo.createdAt,
      usuario: calculo.usuario,
      fuentes: {
        norma: calculo.normaFile
          ? { id: calculo.normaFile.id, filename: calculo.normaFile.filename }
          : null,
        pricing: calculo.pricingFile
          ? {
              id: calculo.pricingFile.id,
              filename: calculo.pricingFile.filename,
            }
          : null,
      },
    };
  }
}

