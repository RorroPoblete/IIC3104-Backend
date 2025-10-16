import csv from 'csv-parser';
import fs from 'fs';
import iconv from 'iconv-lite';
import { Readable } from 'stream';
import { logger } from '../../../shared/utils/logger';

export interface CsvRow {
  [key: string]: string;
}

export interface CsvParseResult {
  headers: string[];
  rows: CsvRow[];
  totalRows: number;
  errors: string[];
}

export class NormaMinsalCsvParser {
  private static normalizeHeader(header: string): string {
    return header ? header.normalize('NFKC').replace(/\s+/g, ' ').trim() : header;
  }

  private static parseStream(stream: NodeJS.ReadableStream): Promise<CsvParseResult> {
    return new Promise((resolve) => {
      const rows: CsvRow[] = [];
      const errors: string[] = [];
      let headers: string[] = [];
      let rowNumber = 0;

      stream
        .pipe(
          csv({
            separator: ';',
            mapHeaders: ({ header }) => NormaMinsalCsvParser.normalizeHeader(header),
          }),
        )
        .on('headers', (headerList: string[]) => {
          headers = headerList;
          logger.info(`Headers de Norma Minsal encontrados: ${headers.length}`);
          logger.info(`Headers: ${headers.join(', ')}`);
        })
        .on('data', (data: CsvRow) => {
          rowNumber += 1;
          rows.push(data);

          if (rowNumber % 1000 === 0) {
            logger.info(`Procesadas ${rowNumber} filas de Norma Minsal`);
          }
        })
        .on('error', (error: Error) => {
          logger.error('Error al parsear CSV de Norma Minsal', error);
          errors.push(`Error en fila ${rowNumber}: ${error.message}`);
        })
        .on('end', () => {
          logger.info(`Parseo de Norma Minsal completado. Total filas: ${rows.length}`);
          resolve({
            headers,
            rows,
            totalRows: rows.length,
            errors,
          });
        });
    });
  }

  static async parseFile(filePath: string): Promise<CsvParseResult> {
    const fileStream = fs.createReadStream(filePath).pipe(iconv.decodeStream('latin1'));
    return NormaMinsalCsvParser.parseStream(fileStream);
  }

  static async parseBuffer(buffer: Buffer): Promise<CsvParseResult> {
    const csvString = iconv.decode(buffer, 'latin1');
    return NormaMinsalCsvParser.parseStream(Readable.from([csvString]));
  }
}

