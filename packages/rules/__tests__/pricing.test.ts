import path from 'path';
import { readFile, utils } from 'xlsx';

import {
  ConvenioNoDisponibleError,
  ConvenioTipo,
  PesoRelativoInvalidoError,
  TarifaRepository,
  configurePricing,
  getPrecioBase,
  resetPricingConfiguration,
} from '../pricing';

type FixtureTramo = 'T1' | 'T2' | 'T3' | undefined;

interface FixtureRow {
  convenio?: string;
  Tramo?: FixtureTramo;
  Precio?: number;
  'fecha admisión'?: Date | string | null;
  'fecha fin'?: Date | string | null;
}

const EXCEL_FIXTURES = buildExcelFixture();

class InMemoryTarifaRepository implements TarifaRepository {
  constructor(
    private readonly data: Record<string, ReturnType<typeof buildConvenio>>,
  ) {}

  findByConvenioId(convenioId: string) {
    return this.data[convenioId];
  }
}

function buildConvenio(
  convenioId: string,
  tipo: ConvenioTipo,
  valor: number,
  tramo?: 'T1' | 'T2' | 'T3',
) {
  const precio: { valor: number; vigencia: {}; tramo?: 'T1' | 'T2' | 'T3' } = {
    valor,
    vigencia: {},
  };

  if (tramo) {
    precio.tramo = tramo;
  }

  return {
    convenioId,
    tipo,
    precios: [precio],
  };
}

describe('pricing rules', () => {
  beforeEach(() => {
    resetPricingConfiguration();
  });

  it('retorna precio único vigente para CH0041', async () => {
    const fechaReferencia = new Date(Date.UTC(2024, 8, 30));
    const result = await getPrecioBase({
      convenioId: 'CH0041',
      pesoRelativo: 1,
      fechaReferencia,
    });

    const esperado = getFixturePrice({
      convenioId: 'CH0041',
      fechaReferencia,
    });

    expect(result.tipo).toBe(ConvenioTipo.PRECIO_UNICO);
    expect(result.valor).toBe(esperado);
    expect(result.fuente).toBe('attachment');
    expect(result.vigencia?.desde).toBeTruthy();
    expect(result.vigencia?.desde?.toISOString().slice(0, 10)).toBe('2024-08-29');
  });

  it('selecciona tramo T1 para FNS012 cuando peso = 1.5', async () => {
    const fechaReferencia = new Date(Date.UTC(2024, 8, 10));
    const resultado = await getPrecioBase({
      convenioId: 'FNS012',
      pesoRelativo: 1.5,
      fechaReferencia,
    });

    expect(resultado.tramoId).toBe('T1');
    expect(resultado.valor).toBe(
      getFixturePrice({
        convenioId: 'FNS012',
        tramo: 'T1',
        fechaReferencia,
      }),
    );
  });

  it('selecciona tramo T2 para FNS012 cuando peso > 1.5 y ≤ 2.5', async () => {
    const fechaReferencia = new Date(Date.UTC(2024, 8, 10));
    const resultado = await getPrecioBase({
      convenioId: 'FNS012',
      pesoRelativo: 2.5,
      fechaReferencia,
    });

    expect(resultado.tramoId).toBe('T2');
    expect(resultado.valor).toBe(
      getFixturePrice({
        convenioId: 'FNS012',
        tramo: 'T2',
        fechaReferencia,
      }),
    );
  });

  it('selecciona tramo T3 para FNS012 cuando peso > 2.5', async () => {
    const fechaReferencia = new Date(Date.UTC(2024, 8, 10));
    const resultado = await getPrecioBase({
      convenioId: 'FNS012',
      pesoRelativo: 2.7,
      fechaReferencia,
    });

    expect(resultado.tramoId).toBe('T3');
    expect(resultado.valor).toBe(
      getFixturePrice({
        convenioId: 'FNS012',
        tramo: 'T3',
        fechaReferencia,
      }),
    );
  });

  it('usa tarifas por tramos de FNS026 sin fechas de vigencia explícitas', async () => {
    const resultado = await getPrecioBase({
      convenioId: 'FNS026',
      pesoRelativo: 2.6,
    });

    expect(resultado.tramoId).toBe('T3');
    expect(resultado.valor).toBe(
      getFixturePrice({ convenioId: 'FNS026', tramo: 'T3' }),
    );
  });

  it('lanza error cuando el convenio no existe', async () => {
    await expect(
      getPrecioBase({
        convenioId: 'DESCONOCIDO',
        pesoRelativo: 1,
      }),
    ).rejects.toBeInstanceOf(ConvenioNoDisponibleError);
  });

  it('lanza error cuando el peso es inválido', async () => {
    await expect(
      getPrecioBase({
        convenioId: 'CH0041',
        pesoRelativo: 0,
      }),
    ).rejects.toBeInstanceOf(PesoRelativoInvalidoError);
  });

  it('prefiere el repositorio de BD cuando está configurado', async () => {
    const repoValor = 99999;
    const repository = new InMemoryTarifaRepository({
      CH0041: buildConvenio('CH0041', ConvenioTipo.PRECIO_UNICO, repoValor),
    });
    configurePricing({ repository });

    const resultado = await getPrecioBase({
      convenioId: 'CH0041',
      pesoRelativo: 1,
    });

    expect(resultado.valor).toBe(repoValor);
    expect(resultado.fuente).toBe('db');
  });

  it('usa el archivo adjunto como respaldo cuando la BD no tiene el convenio', async () => {
    const repository = new InMemoryTarifaRepository({});
    configurePricing({ repository });

    const resultado = await getPrecioBase({
      convenioId: 'FNS026',
      pesoRelativo: 1.4,
    });

    expect(resultado.fuente).toBe('attachment');
    expect(resultado.valor).toBe(
      getFixturePrice({ convenioId: 'FNS026', tramo: 'T1' }),
    );
  });
});

function getFixturePrice({
  convenioId,
  tramo,
  fechaReferencia,
}: {
  convenioId: string;
  tramo?: FixtureTramo;
  fechaReferencia?: Date;
}): number {
  const rows = EXCEL_FIXTURES
    .filter((row) => row.convenio === convenioId)
    .filter((row) => (tramo ? row.Tramo === tramo : true));

  if (fechaReferencia) {
    const targetTime = fechaReferencia.getTime();
    const candidates = rows.filter((row) => {
      const start = toDate(row['fecha admisión'])?.getTime() ?? Number.NEGATIVE_INFINITY;
      const end = toDate(row['fecha fin'])?.getTime() ?? Number.POSITIVE_INFINITY;
      return targetTime >= start && targetTime <= end;
    });
    if (candidates.length > 0) {
      const [match] = candidates;
      return match?.Precio ?? 0;
    }
  }

  const [fallback] = rows;
  return fallback?.Precio ?? 0;
}

function buildExcelFixture(): FixtureRow[] {
  const workbook = readFile(resolveFixturePath(), { cellDates: true });
  const [sheetName] = workbook.SheetNames;
  if (!sheetName) {
    throw new Error('El archivo de fixtures no contiene hojas');
  }
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`No se pudo acceder a la hoja ${sheetName}`);
  }
  return utils.sheet_to_json<FixtureRow>(sheet, { defval: null });
}

function resolveFixturePath(): string {
  return path.resolve(__dirname, '../../../../Precios convenios GRD.xlsx');
}

function toDate(value: Date | string | null | undefined): Date | undefined {
  if (!value) {
    return undefined;
  }
  if (value instanceof Date) {
    return value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}
