import csv from 'csv-parser';
import fs from 'fs';
import iconv from 'iconv-lite';
import { Readable } from 'stream';
import * as XLSX from 'xlsx';
import path from 'path';
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

  private static parseXlsxFile(filePath: string): CsvParseResult {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      
      if (!sheetName) {
        return {
          headers: [],
          rows: [],
          totalRows: 0,
          errors: ['El archivo XLSX no contiene hojas'],
        };
      }
      
      const worksheet = workbook.Sheets[sheetName];
      
      if (!worksheet) {
        return {
          headers: [],
          rows: [],
          totalRows: 0,
          errors: ['La hoja del archivo XLSX no se pudo leer'],
        };
      }
      
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1,
        raw: false,
        defval: '',
      }) as string[][];

      if (jsonData.length === 0) {
        return {
          headers: [],
          rows: [],
          totalRows: 0,
          errors: ['El archivo XLSX está vacío'],
        };
      }

      const headers = (jsonData[0] || []).map((header) => 
        NormaMinsalCsvParser.normalizeHeader(String(header))
      );
      
      const rows: CsvRow[] = [];
      const errors: string[] = [];

      for (let i = 1; i < jsonData.length; i++) {
        const rowData = jsonData[i] || [];
        const row: CsvRow = {};
        
        headers.forEach((header, index) => {
          row[header] = rowData && rowData[index] ? String(rowData[index]).trim() : '';
        });
        
        rows.push(row);

        if (i % 1000 === 0) {
          logger.info(`Procesadas ${i} filas de XLSX de Norma Minsal`);
        }
      }

      logger.info(`Parseo de XLSX de Norma Minsal completado. Total filas: ${rows.length}`);
      
      return {
        headers,
        rows,
        totalRows: rows.length,
        errors,
      };
    } catch (error) {
      logger.error('Error al parsear XLSX de Norma Minsal', error);
      return {
        headers: [],
        rows: [],
        totalRows: 0,
        errors: [`Error al parsear archivo XLSX: ${error instanceof Error ? error.message : 'Error desconocido'}`],
      };
    }
  }

  static async parseFile(filePath: string): Promise<CsvParseResult> {
    const fileExtension = path.extname(filePath).toLowerCase();
    
    if (fileExtension === '.xlsx') {
      logger.info('Parseando archivo XLSX de Norma Minsal');
      return NormaMinsalCsvParser.parseXlsxFile(filePath);
    } else {
      logger.info('Parseando archivo CSV de Norma Minsal');
      const fileStream = fs.createReadStream(filePath).pipe(iconv.decodeStream('latin1'));
      return NormaMinsalCsvParser.parseStream(fileStream);
    }
  }

  static async parseBuffer(buffer: Buffer): Promise<CsvParseResult> {
    const csvString = iconv.decode(buffer, 'latin1');
    return NormaMinsalCsvParser.parseStream(Readable.from([csvString]));
  }
}

