import csv from 'csv-parser';
import fs from 'fs';
import iconv from 'iconv-lite';
import { Readable } from 'stream';
import { logger } from '../../../shared/utils/logger';

export const EXPECTED_COLUMNS = [
  'Episodio CMBD',
  'Edad en años',
  'Sexo (Desc)',
  'Conjunto Dx',
  'Tipo Actividad',
  'Tipo Ingreso (Descripción)',
  'Servicio Ingreso (Descripción)',
  'Servicio Ingreso (Código)',
  'Motivo Egreso (Descripción)',
  'Medico Egreso (Descripción)',
  'Especialidad Servicio Egreso (Descripción)',
  'Servicio Egreso (Código)',
  'Servicio Egreso (Descripción)',
  'Prevision (Cód)',
  'Prevision (Desc)',
  'Prevision 2 ( Cod )',
  'Prevision 2 ( Desc )',
  'Ley ( Cod )',
  'Ley ( Desc )',
  'Convenios (cod)',
  'Convenios (des)',
  'Servicio Salud (cod)',
  'Servicio Salud (des)',
  'Estancias Prequirurgicas Int -Episodio-',
  'Estancias Postquirurgicas Int -Episodio-',
  'EM PRE-Quirúrgica',
  'EM POST-Quirúrgica',
  'Estancia del Episodio',
  'Estancia real del episodio',
  'Horas de Estancia',
  'Estancia Media',
  'Peso GRD Medio (Todos)',
  'Peso Medio [Norma IR]',
  'IEMA IR Bruto',
  'EMAf IR Bruta',
  'Impacto (Estancias evitables) Brutas',
  'IR Gravedad (desc)',
  'IR Mortalidad (desc)',
  'IR Tipo GRD',
  'IR GRD (Código)',
  'IR GRD',
  'IR Punto Corte Inferior',
  'IR Punto Corte Superior',
  'EM [Norma IR]',
  'Estancias [Norma IR]',
  'Casos [Norma IR]',
  'Fecha Ingreso completa',
  'Fecha Completa',
  'Conjunto de Servicios Traslado',
  'Fecha (tr1)',
  'Fecha (tr2)',
  'Fecha (tr3)',
  'Fecha (tr4)',
  'Fecha (tr5)',
  'Fecha (tr6)',
  'Fecha (tr7)',
  'Fecha (tr8)',
  'Fecha (tr9)',
  'Fecha (tr10)',
  'E.M. Traslados Servicio',
  'Facturación Total del episodio',
  'Especialidad médica de la intervención (des)',
  'IR Alta Inlier / Outlier',
  'Año',
  'Mes (Número)',
  'Diagnóstico Principal',
  'Proced 01 Principal (cod)',
  'Conjunto Procedimientos Secundarios',
  'Servicio Ingreso (Código)_1',
  'Servicio(cod) (tr1)',
  'Servicio(cod) (tr2)',
  'Servicio(cod) (tr3)',
  'Servicio(cod) (tr4)',
  'Servicio(cod) (tr5)',
  'Servicio(cod) (tr6)',
  'Servicio(cod) (tr7)',
  'Servicio(cod) (tr8)',
  'Servicio(cod) (tr9)',
  'Servicio(cod) (tr10)',
  'Servicio Egreso (Código)_2',
];

export interface CsvRow {
  [key: string]: string;
}

export interface CsvParseResult {
  headers: string[];
  rows: CsvRow[];
  totalRows: number;
  errors: string[];
}

export class CsvParser {
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
            mapHeaders: ({ header }) => CsvParser.normalizeHeader(header),
          }),
        )
        .on('headers', (headerList: string[]) => {
          headers = headerList;
          logger.info(`Headers encontrados: ${headers.length}`);

          if (headers.length !== EXPECTED_COLUMNS.length) {
            errors.push(`Número de columnas incorrecto. Esperado: ${EXPECTED_COLUMNS.length}, Encontrado: ${headers.length}`);
          }

          const missingColumns = EXPECTED_COLUMNS.filter((column) => !headers.includes(column));
          if (missingColumns.length > 0) {
            errors.push(`Columnas faltantes: ${missingColumns.join(', ')}`);
          }
        })
        .on('data', (data: CsvRow) => {
          rowNumber += 1;
          rows.push(data);

          if (rowNumber % 1000 === 0) {
            logger.info(`Procesadas ${rowNumber} filas`);
          }
        })
        .on('error', (error: Error) => {
          logger.error('Error al parsear CSV', error);
          errors.push(`Error en fila ${rowNumber}: ${error.message}`);
        })
        .on('end', () => {
          logger.info(`Parseo completado. Total filas: ${rows.length}`);
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
    return CsvParser.parseStream(fileStream);
  }

  static async parseBuffer(buffer: Buffer): Promise<CsvParseResult> {
    const csvString = iconv.decode(buffer, 'latin1');
    return CsvParser.parseStream(Readable.from([csvString]));
  }

  static validateStructure(headers: string[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (headers.length !== EXPECTED_COLUMNS.length) {
      errors.push(`Número de columnas incorrecto. Esperado: ${EXPECTED_COLUMNS.length}, Encontrado: ${headers.length}`);
    }

    const missingColumns = EXPECTED_COLUMNS.filter((col) => !headers.includes(col));
    if (missingColumns.length > 0) {
      errors.push(`Columnas faltantes: ${missingColumns.join(', ')}`);
    }

    const extraColumns = headers.filter((col) => !EXPECTED_COLUMNS.includes(col));
    if (extraColumns.length > 0) {
      errors.push(`Columnas extra: ${extraColumns.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
