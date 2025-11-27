import csv from 'csv-parser';
import fs from 'fs';
import iconv from 'iconv-lite';
import path from 'path';
import { Readable } from 'stream';
import XLSX from 'xlsx';
import { logger } from '../../../shared/utils/logger';

export interface PricingRawRow {
  [key: string]: string | number | Date | null;
}

export interface PricingParseResult {
  rows: PricingRawRow[];
  totalRows: number;
  errors: string[];
}

export class PricingParser {
  static async parseFile(filePath: string): Promise<PricingParseResult> {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.csv') {
      return PricingParser.parseCsv(filePath);
    }
    if (ext === '.xlsx' || ext === '.xls') {
      return PricingParser.parseExcel(filePath);
    }
    throw new Error('Formato de archivo no soportado. Use CSV o Excel');
  }

  private static async parseCsv(filePath: string): Promise<PricingParseResult> {
    const buffer = fs.readFileSync(filePath);
    const latinString = iconv.decode(buffer, 'latin1');

    const firstAttempt = await PricingParser.parseCsvStream(
      Readable.from([latinString]),
      ';',
    );
    if (firstAttempt.totalRows > 0 || firstAttempt.errors.length > 0) {
      return firstAttempt;
    }
    return PricingParser.parseCsvStream(Readable.from([latinString]), ',');
  }

  private static parseCsvStream(
    stream: Readable,
    separator: string,
  ): Promise<PricingParseResult> {
    return new Promise((resolve) => {
      const rows: PricingRawRow[] = [];
      const errors: string[] = [];
      let headers: string[] = [];
      let rowCount = 0;

      stream
        .pipe(
          csv({
            separator,
            mapHeaders: ({ header }) => PricingParser.normalizeHeader(header),
          }),
        )
        .on('headers', (headerList: string[]) => {
          headers = headerList;
          logger.info(
            `[PricingParser][CSV] Headers detectados (${separator}): ${headers.length}`,
          );
        })
        .on('data', (data: PricingRawRow) => {
          rowCount += 1;
          rows.push(data);
        })
        .on('error', (error: Error) => {
          logger.error('[PricingParser][CSV] Error de parseo', error);
          errors.push(error.message);
        })
        .on('end', () => {
          resolve({
            rows,
            totalRows: rowCount,
            errors,
          });
        });
    });
  }

  private static async parseExcel(
    filePath: string,
  ): Promise<PricingParseResult> {
    const rows: PricingRawRow[] = [];
    const errors: string[] = [];
    const workbook = XLSX.readFile(filePath, { cellDates: true });
    const [sheetName] = workbook.SheetNames;
    if (!sheetName) {
      throw new Error('El archivo Excel no contiene hojas');
    }
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      throw new Error(`No se pudo acceder a la hoja ${sheetName}`);
    }
    const data = XLSX.utils.sheet_to_json<PricingRawRow>(sheet, {
      defval: null,
    });
    rows.push(...data);

    return {
      rows,
      totalRows: rows.length,
      errors,
    };
  }

  private static normalizeHeader(header: string): string {
    if (!header) {
      return header;
    }
    return header.normalize('NFKC').replace(/\s+/g, ' ').trim();
  }
}
