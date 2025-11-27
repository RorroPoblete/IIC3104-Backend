import { existsSync } from 'fs';
import path from 'path';
import { readFile, utils } from 'xlsx';

export type TramoId = 'T1' | 'T2' | 'T3';

export enum ConvenioTipo {
  PRECIO_UNICO = 'PRECIO_UNICO',
  POR_TRAMOS = 'POR_TRAMOS',
}

export type PricingSource = 'db' | 'attachment';

export interface RangoVigencia {
  desde?: Date;
  hasta?: Date;
}

export interface TramoPrecio {
  id: TramoId;
  etiqueta: string;
  min: number;
  max?: number;
  incluyeMin: boolean;
  incluyeMax: boolean;
}

export interface PrecioBase {
  convenioId: string;
  tipo: ConvenioTipo;
  valor: number;
  fuente: PricingSource;
  tramo?: TramoPrecio;
  tramoId?: TramoId;
  vigencia?: RangoVigencia;
}

export interface GetPrecioBaseParams {
  convenioId: string;
  pesoRelativo: number;
  fechaReferencia?: Date;
  preferSource?: PricingSource | 'auto';
}

export interface TarifaRepository {
  findByConvenioId(
    convenioId: string,
  ): Promise<ConvenioTarifa | undefined> | ConvenioTarifa | undefined;
}

export interface TarifaAttachmentAdapter {
  findByConvenioId(convenioId: string): ConvenioTarifa | undefined;
}

interface TarifaDetalle {
  tramo?: TramoId;
  valor: number;
  vigencia: RangoVigencia;
}

interface ConvenioTarifa {
  convenioId: string;
  descripcion?: string;
  tipo: ConvenioTipo;
  precios: TarifaDetalle[];
}

interface TarifaXlsxRow {
  convenio?: string;
  descr_convenio?: string;
  Tramo?: TramoId | null;
  Precio?: number | string | null;
  'fecha admisión'?: Date | string | null;
  'fecha fin'?: Date | string | null;
}

const TRAMOS: Record<TramoId, TramoPrecio> = {
  T1: {
    id: 'T1',
    etiqueta: '0 ≤ peso ≤ 1.5',
    min: 0,
    max: 1.5,
    incluyeMin: true,
    incluyeMax: true,
  },
  T2: {
    id: 'T2',
    etiqueta: '1.5 < peso ≤ 2.5',
    min: 1.5,
    max: 2.5,
    incluyeMin: false,
    incluyeMax: true,
  },
  T3: {
    id: 'T3',
    etiqueta: 'peso > 2.5',
    min: 2.5,
    incluyeMin: false,
    incluyeMax: false,
  },
};

const ATTACHMENT_FILENAME = 'Precios convenios GRD.xlsx';

function resolveDefaultAttachmentPath(): string {
  const candidates = [
    path.resolve(__dirname, '../../../', ATTACHMENT_FILENAME),
    path.resolve(__dirname, '../../../../', ATTACHMENT_FILENAME),
    path.resolve(process.cwd(), ATTACHMENT_FILENAME),
    path.resolve(process.cwd(), '..', ATTACHMENT_FILENAME),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return (
    candidates[0] ??
    path.resolve(__dirname, '../../../', ATTACHMENT_FILENAME)
  );
}

let defaultAttachmentPath: string;

let activeRepository: TarifaRepository | null = null;
let attachmentAdapter: TarifaAttachmentAdapter;

export class PricingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PricingError';
  }
}

export class PesoRelativoInvalidoError extends PricingError {
  constructor(value: number) {
    super(`Peso relativo inválido: ${value}`);
    this.name = 'PesoRelativoInvalidoError';
  }
}

export class ConvenioNoDisponibleError extends PricingError {
  constructor(convenioId: string) {
    super(`No se encontraron tarifas para el convenio ${convenioId}`);
    this.name = 'ConvenioNoDisponibleError';
  }
}

export class TarifaFueraDeVigenciaError extends PricingError {
  constructor(convenioId: string) {
    super(`No hay tarifas vigentes para el convenio ${convenioId}`);
    this.name = 'TarifaFueraDeVigenciaError';
  }
}

export class TarifaSourceUnavailableError extends PricingError {
  constructor() {
    super('No hay fuentes de tarifas configuradas');
    this.name = 'TarifaSourceUnavailableError';
  }
}

export interface ConfigurePricingOptions {
  repository?: TarifaRepository | null;
  attachmentPath?: string;
  attachmentAdapter?: TarifaAttachmentAdapter;
}

export function configurePricing(options: ConfigurePricingOptions = {}): void {
  if (options.repository !== undefined) {
    activeRepository = options.repository;
  }

  if (options.attachmentAdapter) {
    attachmentAdapter = options.attachmentAdapter;
  } else if (options.attachmentPath) {
    attachmentAdapter = createAttachmentAdapter(options.attachmentPath);
  }
}

export function resetPricingConfiguration(): void {
  activeRepository = null;
  defaultAttachmentPath = resolveDefaultAttachmentPath();
  attachmentAdapter = createAttachmentAdapter(defaultAttachmentPath);
}

export async function getPrecioBase(
  params: GetPrecioBaseParams,
): Promise<PrecioBase> {
  const { convenioId, pesoRelativo } = params;
  validatePesoRelativo(pesoRelativo);

  const referenceDate = params.fechaReferencia ?? new Date();
  const preference = params.preferSource ?? 'auto';

  const { convenio, fuente } = await resolveConvenioData(
    convenioId,
    preference,
  );

  const detalle = seleccionarTarifa(convenio, pesoRelativo, referenceDate);
  const result: PrecioBase = {
    convenioId,
    tipo: convenio.tipo,
    valor: detalle.valor,
    fuente,
    vigencia: detalle.vigencia,
  };

  if (detalle.tramo) {
    result.tramo = TRAMOS[detalle.tramo];
    result.tramoId = detalle.tramo;
  }

  return result;
}

function validatePesoRelativo(value: number): void {
  if (Number.isNaN(value) || !Number.isFinite(value) || value <= 0) {
    throw new PesoRelativoInvalidoError(value);
  }
}

async function resolveConvenioData(
  convenioId: string,
  preference: PricingSource | 'auto',
): Promise<{ convenio: ConvenioTarifa; fuente: PricingSource }> {
  if (!attachmentAdapter && !activeRepository) {
    throw new TarifaSourceUnavailableError();
  }

  if (preference !== 'attachment' && activeRepository) {
    const data = await Promise.resolve(
      activeRepository.findByConvenioId(convenioId),
    );
    if (data) {
      return { convenio: data, fuente: 'db' };
    }
  }

  if (preference !== 'db' && attachmentAdapter) {
    const data = attachmentAdapter.findByConvenioId(convenioId);
    if (data) {
      return { convenio: data, fuente: 'attachment' };
    }
  }

  throw new ConvenioNoDisponibleError(convenioId);
}

function seleccionarTarifa(
  convenio: ConvenioTarifa,
  pesoRelativo: number,
  referenceDate: Date,
): TarifaDetalle {
  if (convenio.tipo === ConvenioTipo.PRECIO_UNICO) {
    const vigente = seleccionarTarifaVigente(convenio.precios, referenceDate);
    if (!vigente) {
      throw new TarifaFueraDeVigenciaError(convenio.convenioId);
    }
    return vigente;
  }

  const tramo = determinarTramo(pesoRelativo);
  const candidatos = convenio.precios.filter(
    (precio) => precio.tramo === tramo.id,
  );
  const vigente = seleccionarTarifaVigente(candidatos, referenceDate);
  if (!vigente) {
    throw new TarifaFueraDeVigenciaError(convenio.convenioId);
  }
  return vigente;
}

function seleccionarTarifaVigente(
  precios: TarifaDetalle[],
  referenceDate: Date,
): TarifaDetalle | undefined {
  const candidatas = precios.filter((precio) =>
    fechaDentroDeVigencia(referenceDate, precio.vigencia),
  );

  if (candidatas.length > 0) {
    return candidatas.sort((a, b) =>
      compararFechasDesc(a.vigencia.desde, b.vigencia.desde),
    )[0];
  }

  return precios
    .slice()
    .sort((a, b) => compararFechasDesc(a.vigencia.desde, b.vigencia.desde))[0];
}

function fechaDentroDeVigencia(
  fecha: Date,
  vigencia: RangoVigencia,
): boolean {
  const desdeOk =
    !vigencia.desde || vigencia.desde.getTime() <= fecha.getTime();
  const hastaOk =
    !vigencia.hasta || vigencia.hasta.getTime() >= fecha.getTime();
  return desdeOk && hastaOk;
}

function compararFechasDesc(a?: Date, b?: Date): number {
  const timeA = a?.getTime() ?? Number.NEGATIVE_INFINITY;
  const timeB = b?.getTime() ?? Number.NEGATIVE_INFINITY;
  return timeB - timeA;
}

function determinarTramo(pesoRelativo: number): TramoPrecio {
  if (pesoRelativo <= TRAMOS.T1.max!) {
    return TRAMOS.T1;
  }
  if (pesoRelativo <= (TRAMOS.T2.max ?? Number.POSITIVE_INFINITY)) {
    if (pesoRelativo === TRAMOS.T2.min) {
      return TRAMOS.T1;
    }
    return TRAMOS.T2;
  }
  if (pesoRelativo === TRAMOS.T3.min) {
    return TRAMOS.T2;
  }
  return TRAMOS.T3;
}

class EmptyTarifaAttachmentAdapter implements TarifaAttachmentAdapter {
  findByConvenioId(): undefined {
    return undefined;
  }
}

export class XlsxTarifaAttachmentAdapter implements TarifaAttachmentAdapter {
  private cache?: Map<string, ConvenioTarifa>;

  constructor(private readonly filePath: string) {}

  findByConvenioId(convenioId: string): ConvenioTarifa | undefined {
    const cache = this.loadCache();
    return cache.get(convenioId);
  }

  private loadCache(): Map<string, ConvenioTarifa> {
    if (this.cache) {
      return this.cache;
    }
    const workbook = readFile(this.filePath, { cellDates: true });
    const [sheetName] = workbook.SheetNames;
    if (!sheetName) {
      throw new PricingError('El archivo de tarifas no contiene hojas');
    }
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      throw new PricingError(`No se pudo acceder a la hoja ${sheetName}`);
    }
    const rows = utils.sheet_to_json<TarifaXlsxRow>(sheet, {
      defval: null,
    });

    const grouped = new Map<string, TarifaDetalle[]>();
    const metadata = new Map<
      string,
      { descripcion?: string; tipo: ConvenioTipo }
    >();

    for (const row of rows) {
      if (!row || !row.convenio || row.Precio == null) {
        continue;
      }

      const convenioId = String(row.convenio).trim();
      const precio = Number(row.Precio);
      if (Number.isNaN(precio)) {
        continue;
      }

      const tramoValue = row.Tramo ? (row.Tramo as TramoId) : undefined;
      const tipo = tramoValue
        ? ConvenioTipo.POR_TRAMOS
        : ConvenioTipo.PRECIO_UNICO;

      const metaValue: { descripcion?: string; tipo: ConvenioTipo } = { tipo };
      if (row.descr_convenio) {
        metaValue.descripcion = String(row.descr_convenio);
      }
      metadata.set(convenioId, metaValue);

      const vigencia: RangoVigencia = {};
      const desde = normalizarFecha(row['fecha admisión']);
      if (desde) {
        vigencia.desde = desde;
      }
      const hasta = normalizarFecha(row['fecha fin']);
      if (hasta) {
        vigencia.hasta = hasta;
      }

      const detalle: TarifaDetalle = {
        valor: precio,
        vigencia,
      };
      if (tramoValue) {
        detalle.tramo = tramoValue;
      }

      const lista = grouped.get(convenioId);
      if (lista) {
        lista.push(detalle);
      } else {
        grouped.set(convenioId, [detalle]);
      }
    }

    const data = new Map<string, ConvenioTarifa>();
    for (const [convenioId, precios] of grouped.entries()) {
      const info = metadata.get(convenioId);
      const entry: ConvenioTarifa = {
        convenioId,
        tipo: info?.tipo ?? ConvenioTipo.PRECIO_UNICO,
        precios,
      };
      if (info?.descripcion) {
        entry.descripcion = info.descripcion;
      }
      data.set(convenioId, entry);
    }

    this.cache = data;
    return data;
  }
}

function createAttachmentAdapter(
  attachmentPath: string,
): TarifaAttachmentAdapter {
  if (!attachmentPath || !existsSync(attachmentPath)) {
    return new EmptyTarifaAttachmentAdapter();
  }
  return new XlsxTarifaAttachmentAdapter(attachmentPath);
}

defaultAttachmentPath = resolveDefaultAttachmentPath();
attachmentAdapter = createAttachmentAdapter(defaultAttachmentPath);

function normalizarFecha(value: Date | string | null | undefined): Date | undefined {
  if (!value) {
    return undefined;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }
  return undefined;
}
