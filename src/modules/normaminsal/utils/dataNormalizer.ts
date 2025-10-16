import { CsvRow } from './csvParser';
import { logger } from '../../../shared/utils/logger';

export interface NormaMinsalNormalizedData {
  grd: string;
  tipoGrd?: string | null;
  gravedad?: string | null;
  totalAltas?: number | null;
  totalEst?: number | null;
  estMedia?: number | null;
  altasDepu?: number | null;
  totalEstDepu?: number | null;
  estMediaDepuG?: number | null;
  numOutInfG?: number | null;
  nOutliersSup?: number | null;
  exitus?: number | null;
  percentil25?: number | null;
  percentil50?: number | null;
  percentil75?: number | null;
  puntoCorteInferior?: number | null;
  puntoCorteSuperior?: number | null;
  pesoTotal?: number | null;
  pesoTotalDepu?: number | null;
  rawData: Record<string, string>;
}

export class NormaMinsalDataNormalizer {
  static normalizeRow(csvRow: CsvRow): NormaMinsalNormalizedData {
    const grd = this.cleanString(csvRow['GRD']);

    if (!grd) {
      logger.warn('Fila sin código GRD encontrada');
    }

    return {
      grd: grd || '',
      tipoGrd: this.cleanString(csvRow['Tipo GRD']),
      gravedad: this.cleanString(csvRow['GRAVEDAD']),
      totalAltas: this.parseInteger(csvRow['Total Altas']),
      totalEst: this.parseFloat(csvRow['Total Est']),
      estMedia: this.parseFloat(csvRow['Est Media']),
      altasDepu: this.parseInteger(csvRow['Altas Depu']),
      totalEstDepu: this.parseFloat(csvRow['Total Est Depu']),
      estMediaDepuG: this.parseFloat(csvRow['TAB_1430_D_EST_MED_DEPU_G']),
      numOutInfG: this.parseInteger(csvRow['TAB_1430_D_NUM_OUT_INF_G']),
      nOutliersSup: this.parseInteger(csvRow['N Outliers Sup']),
      exitus: this.parseInteger(csvRow['Exitus']),
      percentil25: this.parseFloat(csvRow['Percentil 25']),
      percentil50: this.parseFloat(csvRow['TAB_1430_D_PERCT_50_G']),
      percentil75: this.parseFloat(csvRow['Percentil 75']),
      puntoCorteInferior: this.parseFloat(csvRow['Punto Corte Inferior']),
      puntoCorteSuperior: this.parseFloat(csvRow['Punto Corte Superior']),
      pesoTotal: this.parseFloat(csvRow['Peso Total']),
      pesoTotalDepu: this.parseFloat(csvRow['Peso Total Depu']),
      rawData: csvRow,
    };
  }

  private static parseInteger(value: string | undefined): number | null {
    const normalized = this.normalizeNumber(value);
    if (normalized === null) {
      return null;
    }

    const parsed = Number.parseFloat(normalized);
    return Number.isNaN(parsed) ? null : Math.trunc(parsed);
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

  private static parseFloat(value: string | undefined): number | null {
    const normalized = this.normalizeNumber(value);
    if (normalized === null) {
      return null;
    }

    const parsed = Number.parseFloat(normalized);
    return Number.isNaN(parsed) ? null : parsed;
  }
}

