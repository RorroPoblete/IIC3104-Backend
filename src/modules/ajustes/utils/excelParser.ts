import XLSX from 'xlsx';
import fs from 'fs';
import { logger } from '../../../shared/utils/logger';

export interface ExcelRow {
  [key: string]: string;
}

export interface ExcelParseResult {
  headers: string[];
  rows: ExcelRow[];
  totalRows: number;
  errors: string[];
}

export class AjustesTecnologiaExcelParser {
  private static normalizeHeader(header: string): string {
    return header ? header.normalize('NFKC').replace(/\s+/g, ' ').trim() : header;
  }

  static async parseFile(filePath: string): Promise<ExcelParseResult> {
    const errors: string[] = [];
    let rows: ExcelRow[] = [];
    let headers: string[] = [];

    try {
      const fileBuffer = fs.readFileSync(filePath);
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

      // Get the first sheet
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        throw new Error('El archivo Excel no contiene hojas');
      }

      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) {
        throw new Error('No se pudo acceder a la hoja del Excel');
      }

      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as (string | number | boolean)[][];

      if (data.length === 0) {
        throw new Error('El archivo Excel está vacío');
      }

      // Extract headers from first row
      const firstRow = data[0];
      if (!firstRow) {
        throw new Error('La primera fila no contiene datos');
      }

      headers = (firstRow as string[]).map((header) =>
        AjustesTecnologiaExcelParser.normalizeHeader(String(header)),
      );

      logger.info(`Headers de Ajustes por Tecnología encontrados: ${headers.length}`);
      logger.info(`Headers: ${headers.join(', ')}`);

      // Process data rows (skip header)
      for (let i = 1; i < data.length; i++) {
        const row = data[i] as (string | number | boolean)[];
        if (!row || !Array.isArray(row)) {
          continue;
        }

        const rowObject: ExcelRow = {};

        for (let j = 0; j < headers.length; j++) {
          const header = headers[j];
          if (header) {
            const value = row[j];
            rowObject[header] = value !== undefined && value !== null ? String(value) : '';
          }
        }

        rows.push(rowObject);

        if (i % 1000 === 0) {
          logger.info(`Procesadas ${i - 1} filas de Ajustes por Tecnología`);
        }
      }

      logger.info(`Parseo de Excel de Ajustes por Tecnología completado. Total filas: ${rows.length}`);

      return {
        headers,
        rows,
        totalRows: rows.length,
        errors,
      };
    } catch (error) {
      logger.error('Error al parsear Excel de Ajustes por Tecnología', error);
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Error al procesar Excel: ${message}`);

      return {
        headers: [],
        rows: [],
        totalRows: 0,
        errors,
      };
    }
  }
}



