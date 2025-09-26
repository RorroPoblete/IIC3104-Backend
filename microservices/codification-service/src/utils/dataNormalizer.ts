import { CsvRow } from './csvParser';
import { logger } from './logger';

export interface NormalizedData {
  episodioCmbd?: string;
  edadAnos?: number;
  sexo?: string;
  conjuntoDx?: string;
  tipoActividad?: string;
  tipoIngreso?: string;
  servicioIngresoDesc?: string;
  servicioIngresoCod?: string;
  motivoEgreso?: string;
  medicoEgreso?: string;
  especialidadEgreso?: string;
  servicioEgresoCod?: string;
  servicioEgresoDesc?: string;

  previsionCod?: string;
  previsionDesc?: string;
  prevision2Cod?: string;
  prevision2Desc?: string;

  leyCod?: string;
  leyDesc?: string;
  conveniosCod?: string;
  conveniosDesc?: string;

  servicioSaludCod?: string;
  servicioSaludDesc?: string;

  estanciasPrequirurgicas?: number;
  estanciasPostquirurgicas?: number;
  emPreQuirurgica?: number;
  emPostQuirurgica?: number;
  estanciaEpisodio?: number;
  estanciaRealEpisodio?: number;
  horasEstancia?: number;
  estanciaMedia?: number;

  pesoGrdMedio?: number;
  pesoMedioNorma?: number;
  iemaIrBruto?: number;
  emafIrBruta?: number;
  impactoEstancias?: number;
  irGravedad?: string;
  irMortalidad?: string;
  irTipoGrd?: string;
  irGrdCodigo?: string;
  irGrd?: string;
  irPuntoCorteInferior?: number;
  irPuntoCorteSuperior?: number;
  emNorma?: number;
  estanciasNorma?: number;
  casosNorma?: number;

  fechaIngresoCompleta?: Date;
  fechaCompleta?: Date;

  conjuntoServiciosTraslado?: string;
  fechaTr1?: Date;
  fechaTr2?: Date;
  fechaTr3?: Date;
  fechaTr4?: Date;
  fechaTr5?: Date;
  fechaTr6?: Date;
  fechaTr7?: Date;
  fechaTr8?: Date;
  fechaTr9?: Date;
  fechaTr10?: Date;
  emTrasladosServicio?: number;

  facturacionTotal?: number;
  especialidadMedica?: string;
  irAltaInlier?: string;

  anio?: number;
  mes?: number;
  diagnosticoPrincipal?: string;
  proced01Principal?: string;
  conjuntoProcedimientosSecundarios?: string;

  servicioIngresoCod1?: string;
  servicioCodTr1?: string;
  servicioCodTr2?: string;
  servicioCodTr3?: string;
  servicioCodTr4?: string;
  servicioCodTr5?: string;
  servicioCodTr6?: string;
  servicioCodTr7?: string;
  servicioCodTr8?: string;
  servicioCodTr9?: string;
  servicioCodTr10?: string;
  servicioEgresoCod2?: string;
}

export class DataNormalizer {
  static normalizeRow(csvRow: CsvRow): NormalizedData {
    return {
      episodioCmbd: this.cleanString(csvRow['Episodio CMBD']),
      edadAnos: this.parseInteger(csvRow['Edad en años']),
      sexo: this.cleanString(csvRow['Sexo (Desc)']),
      conjuntoDx: this.cleanString(csvRow['Conjunto Dx']),
      tipoActividad: this.cleanString(csvRow['Tipo Actividad']),
      tipoIngreso: this.cleanString(csvRow['Tipo Ingreso (Descripción)']),
      servicioIngresoDesc: this.cleanString(csvRow['Servicio Ingreso (Descripción)']),
      servicioIngresoCod: this.cleanString(csvRow['Servicio Ingreso (Código)']),
      motivoEgreso: this.cleanString(csvRow['Motivo Egreso (Descripción)']),
      medicoEgreso: this.cleanString(csvRow['Medico Egreso (Descripción)']),
      especialidadEgreso: this.cleanString(csvRow['Especialidad Servicio Egreso (Descripción)']),
      servicioEgresoCod: this.cleanString(csvRow['Servicio Egreso (Código)']),
      servicioEgresoDesc: this.cleanString(csvRow['Servicio Egreso (Descripción)']),

      previsionCod: this.cleanString(csvRow['Prevision (Cód)']),
      previsionDesc: this.cleanString(csvRow['Prevision (Desc)']),
      prevision2Cod: this.cleanString(csvRow['Prevision 2 ( Cod )']),
      prevision2Desc: this.cleanString(csvRow['Prevision 2 ( Desc )']),

      leyCod: this.cleanString(csvRow['Ley ( Cod )']),
      leyDesc: this.cleanString(csvRow['Ley ( Desc )']),
      conveniosCod: this.cleanString(csvRow['Convenios (cod)']),
      conveniosDesc: this.cleanString(csvRow['Convenios (des)']),

      servicioSaludCod: this.cleanString(csvRow['Servicio Salud (cod)']),
      servicioSaludDesc: this.cleanString(csvRow['Servicio Salud (des)']),

      estanciasPrequirurgicas: this.parseFloat(csvRow['Estancias Prequirurgicas Int -Episodio-']),
      estanciasPostquirurgicas: this.parseFloat(csvRow['Estancias Postquirurgicas Int -Episodio-']),
      emPreQuirurgica: this.parseFloat(csvRow['EM PRE-Quirúrgica']),
      emPostQuirurgica: this.parseFloat(csvRow['EM POST-Quirúrgica']),
      estanciaEpisodio: this.parseFloat(csvRow['Estancia del Episodio']),
      estanciaRealEpisodio: this.parseFloat(csvRow['Estancia real del episodio']),
      horasEstancia: this.parseFloat(csvRow['Horas de Estancia']),
      estanciaMedia: this.parseFloat(csvRow['Estancia Media']),

      pesoGrdMedio: this.parseFloat(csvRow['Peso GRD Medio (Todos)']),
      pesoMedioNorma: this.parseFloat(csvRow['Peso Medio [Norma IR]']),
      iemaIrBruto: this.parseFloat(csvRow['IEMA IR Bruto']),
      emafIrBruta: this.parseFloat(csvRow['EMAf IR Bruta']),
      impactoEstancias: this.parseFloat(csvRow['Impacto (Estancias evitables) Brutas']),
      irGravedad: this.cleanString(csvRow['IR Gravedad (desc)']),
      irMortalidad: this.cleanString(csvRow['IR Mortalidad (desc)']),
      irTipoGrd: this.cleanString(csvRow['IR Tipo GRD']),
      irGrdCodigo: this.cleanString(csvRow['IR GRD (Código)']),
      irGrd: this.cleanString(csvRow['IR GRD']),
      irPuntoCorteInferior: this.parseFloat(csvRow['IR Punto Corte Inferior']),
      irPuntoCorteSuperior: this.parseFloat(csvRow['IR Punto Corte Superior']),
      emNorma: this.parseFloat(csvRow['EM [Norma IR]']),
      estanciasNorma: this.parseFloat(csvRow['Estancias [Norma IR]']),
      casosNorma: this.parseFloat(csvRow['Casos [Norma IR]']),

      fechaIngresoCompleta: this.parseDate(csvRow['Fecha Ingreso completa']),
      fechaCompleta: this.parseDate(csvRow['Fecha Completa']),

      conjuntoServiciosTraslado: this.cleanString(csvRow['Conjunto de Servicios Traslado']),
      fechaTr1: this.parseDate(csvRow['Fecha (tr1)']),
      fechaTr2: this.parseDate(csvRow['Fecha (tr2)']),
      fechaTr3: this.parseDate(csvRow['Fecha (tr3)']),
      fechaTr4: this.parseDate(csvRow['Fecha (tr4)']),
      fechaTr5: this.parseDate(csvRow['Fecha (tr5)']),
      fechaTr6: this.parseDate(csvRow['Fecha (tr6)']),
      fechaTr7: this.parseDate(csvRow['Fecha (tr7)']),
      fechaTr8: this.parseDate(csvRow['Fecha (tr8)']),
      fechaTr9: this.parseDate(csvRow['Fecha (tr9)']),
      fechaTr10: this.parseDate(csvRow['Fecha (tr10)']),
      emTrasladosServicio: this.parseFloat(csvRow['E.M. Traslados Servicio']),

      facturacionTotal: this.parseFloat(csvRow['Facturación Total del episodio']),
      especialidadMedica: this.cleanString(csvRow['Especialidad médica de la intervención (des)']),
      irAltaInlier: this.cleanString(csvRow['IR Alta Inlier / Outlier']),

      anio: this.parseInteger(csvRow['Año']),
      mes: this.parseInteger(csvRow['Mes (Número)']),
      diagnosticoPrincipal: this.cleanString(csvRow['Diagnóstico Principal']),
      proced01Principal: this.cleanString(csvRow['Proced 01 Principal (cod)']),
      conjuntoProcedimientosSecundarios: this.cleanString(csvRow['Conjunto Procedimientos Secundarios']),

      servicioIngresoCod1: this.cleanString(csvRow['Servicio Ingreso (Código)_1']),
      servicioCodTr1: this.cleanString(csvRow['Servicio(cod) (tr1)']),
      servicioCodTr2: this.cleanString(csvRow['Servicio(cod) (tr2)']),
      servicioCodTr3: this.cleanString(csvRow['Servicio(cod) (tr3)']),
      servicioCodTr4: this.cleanString(csvRow['Servicio(cod) (tr4)']),
      servicioCodTr5: this.cleanString(csvRow['Servicio(cod) (tr5)']),
      servicioCodTr6: this.cleanString(csvRow['Servicio(cod) (tr6)']),
      servicioCodTr7: this.cleanString(csvRow['Servicio(cod) (tr7)']),
      servicioCodTr8: this.cleanString(csvRow['Servicio(cod) (tr8)']),
      servicioCodTr9: this.cleanString(csvRow['Servicio(cod) (tr9)']),
      servicioCodTr10: this.cleanString(csvRow['Servicio(cod) (tr10)']),
      servicioEgresoCod2: this.cleanString(csvRow['Servicio Egreso (Código)_2']),
    };
  }

  private static cleanString(value: string | undefined): string | undefined {
    if (!value || value.trim() === '') {
      return undefined;
    }
    return value.trim();
  }

  private static normalizeNumber(value: string | undefined): string | undefined {
    if (!value) {
      return undefined;
    }

    let normalized = value.trim();
    if (normalized === '') {
      return undefined;
    }

    normalized = normalized.replace(/\s+/g, '');

    const hasComma = normalized.includes(',');
    const hasDot = normalized.includes('.');

    if (hasComma && hasDot) {
      normalized = normalized.replace(/\./g, '');
      normalized = normalized.replace(/,/g, '.');
    } else if (hasComma) {
      normalized = normalized.replace(/,/g, '.');
    } else {
      normalized = normalized.replace(/,/g, '');
    }

    normalized = normalized.replace(/[^0-9.+\-Ee]/g, '');

    if (normalized === '' || normalized === '+' || normalized === '-' || normalized === '.' || normalized === '+.' || normalized === '-.') {
      return undefined;
    }

    return normalized;
  }

  private static parseInteger(value: string | undefined): number | undefined {
    const normalized = this.normalizeNumber(value);
    if (normalized === undefined) {
      return undefined;
    }

    const parsed = Number.parseFloat(normalized);
    return Number.isNaN(parsed) ? undefined : Math.trunc(parsed);
  }

  private static parseFloat(value: string | undefined): number | undefined {
    const normalized = this.normalizeNumber(value);
    if (normalized === undefined) {
      return undefined;
    }

    const parsed = Number.parseFloat(normalized);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  private static parseDate(value: string | undefined): Date | undefined {
    if (!value || value.trim() === '') {
      return undefined;
    }

    const cleaned = value.trim();

    const formats = [
      /^(\d{1,2})-(\d{1,2})-(\d{4})\s+(\d{1,2}):(\d{1,2})$/,
      /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
      /^\d{4}-\d{2}-\d{2}$/,
      /^\d{2}\/\d{2}\/\d{4}$/,
      /^\d{4}\/\d{2}\/\d{2}$/,
    ];

    const dateTimeMatch = cleaned.match(/^(\d{1,2})-(\d{1,2})-(\d{4})\s+(\d{1,2}):(\d{1,2})$/);
    if (dateTimeMatch) {
      const [, day, month, year, hour, minute] = dateTimeMatch;
      const date = new Date(
        parseInt(year, 10),
        parseInt(month, 10) - 1,
        parseInt(day, 10),
        parseInt(hour, 10),
        parseInt(minute, 10)
      );
      if (!Number.isNaN(date.getTime())) {
        return date;
      }
    }

    const dateMatch = cleaned.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (dateMatch) {
      const [, day, month, year] = dateMatch;
      const date = new Date(
        parseInt(year, 10),
        parseInt(month, 10) - 1,
        parseInt(day, 10)
      );
      if (!Number.isNaN(date.getTime())) {
        return date;
      }
    }

    for (const format of formats.slice(2)) {
      if (format.test(cleaned)) {
        const date = new Date(cleaned);
        if (!Number.isNaN(date.getTime())) {
          return date;
        }
      }
    }
    
    logger.warn(`No se pudo parsear la fecha: ${cleaned}`);
    return undefined;
  }
}
