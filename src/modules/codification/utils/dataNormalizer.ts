import { CsvRow } from './csvParser';
import { logger } from '../../../shared/utils/logger';

export interface NormalizedData {
  episodioCmbd?: string | null;
  edadAnos?: number | null;
  sexo?: string | null;
  conjuntoDx?: string | null;
  tipoActividad?: string | null;
  tipoIngreso?: string | null;
  servicioIngresoDesc?: string | null;
  servicioIngresoCod?: string | null;
  motivoEgreso?: string | null;
  medicoEgreso?: string | null;
  especialidadEgreso?: string | null;
  servicioEgresoCod?: string | null;
  servicioEgresoDesc?: string | null;

  previsionCod?: string | null;
  previsionDesc?: string | null;
  prevision2Cod?: string | null;
  prevision2Desc?: string | null;

  leyCod?: string | null;
  leyDesc?: string | null;
  conveniosCod?: string | null;
  conveniosDesc?: string | null;

  servicioSaludCod?: string | null;
  servicioSaludDesc?: string | null;

  estanciasPrequirurgicas?: number | null;
  estanciasPostquirurgicas?: number | null;
  emPreQuirurgica?: number | null;
  emPostQuirurgica?: number | null;
  estanciaEpisodio?: number | null;
  estanciaRealEpisodio?: number | null;
  horasEstancia?: number | null;
  estanciaMedia?: number | null;

  pesoGrdMedio?: number | null;
  pesoMedioNorma?: number | null;
  iemaIrBruto?: number | null;
  emafIrBruta?: number | null;
  impactoEstancias?: number | null;
  irGravedad?: string | null;
  irMortalidad?: string | null;
  irTipoGrd?: string | null;
  irGrdCodigo?: string | null;
  irGrd?: string | null;
  irPuntoCorteInferior?: number | null;
  irPuntoCorteSuperior?: number | null;
  emNorma?: number | null;
  estanciasNorma?: number | null;
  casosNorma?: number | null;

  fechaIngresoCompleta?: Date | null;
  fechaCompleta?: Date | null;

  conjuntoServiciosTraslado?: string | null;
  fechaTr1?: Date | null;
  fechaTr2?: Date | null;
  fechaTr3?: Date | null;
  fechaTr4?: Date | null;
  fechaTr5?: Date | null;
  fechaTr6?: Date | null;
  fechaTr7?: Date | null;
  fechaTr8?: Date | null;
  fechaTr9?: Date | null;
  fechaTr10?: Date | null;
  emTrasladosServicio?: number | null;

  facturacionTotal?: number | null;
  especialidadMedica?: string | null;
  irAltaInlier?: string | null;

  anio?: number | null;
  mes?: number | null;
  diagnosticoPrincipal?: string | null;
  proced01Principal?: string | null;
  conjuntoProcedimientosSecundarios?: string | null;

  servicioIngresoCod1?: string | null;
  servicioCodTr1?: string | null;
  servicioCodTr2?: string | null;
  servicioCodTr3?: string | null;
  servicioCodTr4?: string | null;
  servicioCodTr5?: string | null;
  servicioCodTr6?: string | null;
  servicioCodTr7?: string | null;
  servicioCodTr8?: string | null;
  servicioCodTr9?: string | null;
  servicioCodTr10?: string | null;
  servicioEgresoCod2?: string | null;
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

  private static cleanString(value: string | undefined): string | null {
    if (!value || value.trim() === '') {
      return null;
    }
    return value.trim();
  }

  private static normalizeNumber(value: string | undefined): string | null {
    if (!value) {
      return null;
    }

    let normalized = value.trim();
    if (normalized === '') {
      return null;
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
      return null;
    }

    return normalized;
  }

  private static parseInteger(value: string | undefined): number | null {
    const normalized = this.normalizeNumber(value);
    if (normalized === null) {
      return null;
    }

    const parsed = Number.parseFloat(normalized);
    return Number.isNaN(parsed) ? null : Math.trunc(parsed);
  }

  private static parseFloat(value: string | undefined): number | null {
    const normalized = this.normalizeNumber(value);
    if (normalized === null) {
      return null;
    }

    const parsed = Number.parseFloat(normalized);
    return Number.isNaN(parsed) ? null : parsed;
  }

  private static parseDate(value: string | undefined): Date | null {
    if (!value || value.trim() === '') {
      return null;
    }

    const cleaned = value.trim();

    const dateTimeMatch = cleaned.match(/^(\d{1,2})-(\d{1,2})-(\d{4})\s+(\d{1,2}):(\d{1,2})$/);
    if (dateTimeMatch) {
      const [, day = '', month = '', year = '', hour = '', minute = ''] = dateTimeMatch;
      const date = new Date(
        parseInt(year, 10),
        parseInt(month, 10) - 1,
        parseInt(day, 10),
        parseInt(hour, 10),
        parseInt(minute, 10),
      );
      if (!Number.isNaN(date.getTime())) {
        return date;
      }
    }

    const dateMatch = cleaned.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (dateMatch) {
      const [, day = '', month = '', year = ''] = dateMatch;
      const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
      if (!Number.isNaN(date.getTime())) {
        return date;
      }
    }

    const fallbackFormats = [/^\d{4}-\d{2}-\d{2}$/, /^\d{2}\/\d{2}\/\d{4}$/, /^\d{4}\/\d{2}\/\d{2}$/];
    for (const format of fallbackFormats) {
      if (format.test(cleaned)) {
        const date = new Date(cleaned);
        if (!Number.isNaN(date.getTime())) {
          return date;
        }
      }
    }

    logger.warn(`No se pudo parsear la fecha: ${cleaned}`);
    return null;
  }
}
