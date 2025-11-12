import { ImportStatus } from '@prisma/client';
import {
  ConvenioTipo,
  RangoVigencia,
  TarifaRepository,
  TramoId,
} from '../../../../packages/rules/pricing';
import { prisma } from '../../../shared/db/prisma';

const TRAMO_IDS: ReadonlyArray<TramoId> = ['T1', 'T2', 'T3'];

export class PrismaPricingTarifaRepository implements TarifaRepository {
  async findByConvenioId(convenioId: string) {
    const activeFile = await prisma.pricingFile.findFirst({
      where: { isActive: true, status: ImportStatus.COMPLETED },
      select: { id: true },
    });

    if (!activeFile) {
      return undefined;
    }

    const tarifas = await prisma.pricingTarifa.findMany({
      where: { fileId: activeFile.id, convenioId },
      orderBy: [{ tramo: 'asc' }, { fechaAdmision: 'desc' }],
    });

    if (tarifas.length === 0) {
      return undefined;
    }

    const tipo = tarifas.some((tarifa) => Boolean(tarifa.tramo))
      ? ConvenioTipo.POR_TRAMOS
      : ConvenioTipo.PRECIO_UNICO;

    const precios = tarifas.map((tarifa) => {
      const vigencia: RangoVigencia = {};
      if (tarifa.fechaAdmision) {
        vigencia.desde = tarifa.fechaAdmision;
      }
      if (tarifa.fechaFin) {
        vigencia.hasta = tarifa.fechaFin;
      }

      const detalle: {
        valor: number;
        vigencia: RangoVigencia;
        tramo?: TramoId;
      } = {
        valor: Number(tarifa.precio),
        vigencia,
      };

      if (tarifa.tramo && esTramoValido(tarifa.tramo)) {
        detalle.tramo = tarifa.tramo;
      }

      return detalle;
    });

    const descripcion = tarifas.find(
      (tarifa) => tarifa.descripcionConvenio?.length,
    )?.descripcionConvenio;

    const convenio: {
      convenioId: string;
      tipo: ConvenioTipo;
      precios: Array<{
        valor: number;
        vigencia: RangoVigencia;
        tramo?: TramoId;
      }>;
      descripcion?: string;
    } = {
      convenioId,
      tipo,
      precios,
    };

    if (descripcion) {
      convenio.descripcion = descripcion;
    }

    return convenio;
  }
}

function esTramoValido(value: string): value is TramoId {
  return TRAMO_IDS.includes(value as TramoId);
}
