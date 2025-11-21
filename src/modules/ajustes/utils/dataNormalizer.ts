import { ExcelRow } from './excelParser';
import { logger } from '../../../shared/utils/logger';
import { Prisma } from '@prisma/client';

export interface AjustesTecnologiaNormalizedData {
  codigo: string;
  descripcion?: string | null;
  monto: number;
  rawData: Record<string, string>;
}

export class AjustesTecnologiaDataNormalizer {
  static normalizeRow(excelRow: ExcelRow): AjustesTecnologiaNormalizedData {
    // Buscar columna de código (puede venir como "Código", "Codigo", etc.)
    const codigo = this.findColumnValue(excelRow, ['Código', 'Codigo', 'codigo', 'CODIGO', 'Código Procedimiento']);
    
    if (!codigo || codigo.trim() === '') {
      logger.warn('Fila sin código encontrada en ajustes por tecnología');
    }

    // Buscar columna de descripción
    const descripcion = this.findColumnValue(excelRow, [
      'Descripción',
      'Descripcion',
      'descripcion',
      'DESCRIPCION',
      'Descripción Tecnología',
      'Tecnología',
      'Tecnologia',
    ]);

    // Buscar columna de monto/valor
    const montoStr = this.findColumnValue(excelRow, [
      'Monto',
      'monto',
      'MONTO',
      'Valor',
      'valor',
      'VALOR',
      'Ajuste',
      'ajuste',
      'AJUSTE',
    ]);

    const monto = this.parseDecimal(montoStr);

    if (monto === null || monto < 0) {
      logger.warn(`Monto inválido o negativo en ajuste: ${montoStr}`);
    }

    return {
      codigo: codigo || '',
      descripcion: descripcion || null,
      monto: monto || 0,
      rawData: excelRow,
    };
  }

  private static findColumnValue(row: ExcelRow, possibleNames: string[]): string | null {
    for (const name of possibleNames) {
      if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
        return String(row[name]).trim();
      }
    }
    return null;
  }

  private static parseDecimal(value: string | null | undefined): number | null {
    if (!value) {
      return null;
    }

    // Limpiar el valor: remover espacios, símbolos de moneda, etc.
    const cleaned = value
      .toString()
      .trim()
      .replace(/[^\d.,-]/g, '') // Remover todo excepto dígitos, puntos, comas y signos menos
      .replace(/\./g, '') // Remover puntos (separadores de miles)
      .replace(',', '.'); // Convertir coma a punto decimal

    const parsed = Number.parseFloat(cleaned);
    if (Number.isNaN(parsed)) {
      return null;
    }

    return parsed;
  }

  private static cleanString(value: string | undefined): string | null {
    if (!value) {
      return null;
    }
    const cleaned = value.toString().trim();
    return cleaned === '' ? null : cleaned;
  }
}



