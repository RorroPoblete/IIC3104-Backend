import {
  ConvenioNoDisponibleError,
  ConvenioTipo,
  PesoRelativoInvalidoError,
  TarifaFueraDeVigenciaError,
  TarifaSourceUnavailableError,
  configurePricing,
  resetPricingConfiguration,
} from '../../../../packages/rules/pricing';
import { PricingService } from '../services/pricingService';
import { PrismaPricingTarifaRepository } from '../repositories/prismaPricingRepository';

// Mock del repositorio Prisma
jest.mock('../repositories/prismaPricingRepository');

describe('PricingService', () => {
  beforeEach(() => {
    resetPricingConfiguration();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('calculatePrecioBase', () => {
    it('debe calcular precio único correctamente', async () => {
      // Configurar un repositorio mock con datos de precio único
      const mockRepository = {
        findByConvenioId: jest.fn().mockResolvedValue({
          convenioId: 'CH0041',
          tipo: ConvenioTipo.PRECIO_UNICO,
          precios: [
            {
              valor: 150000,
              vigencia: {
                desde: new Date('2024-01-01'),
                hasta: new Date('2024-12-31'),
              },
            },
          ],
        }),
      };

      configurePricing({ repository: mockRepository as any });

      const resultado = await PricingService.calculatePrecioBase({
        convenioId: 'CH0041',
        pesoRelativo: 1.0,
        fechaReferencia: new Date('2024-06-01'),
      });

      expect(resultado.convenioId).toBe('CH0041');
      expect(resultado.tipo).toBe(ConvenioTipo.PRECIO_UNICO);
      expect(resultado.valor).toBe(150000);
      expect(resultado.tramo).toBeUndefined();
    });

    it('debe calcular precio por tramos T1 correctamente', async () => {
      const mockRepository = {
        findByConvenioId: jest.fn().mockResolvedValue({
          convenioId: 'FNS012',
          tipo: ConvenioTipo.POR_TRAMOS,
          precios: [
            {
              tramo: 'T1',
              valor: 100000,
              vigencia: {
                desde: new Date('2024-01-01'),
              },
            },
            {
              tramo: 'T2',
              valor: 150000,
              vigencia: {
                desde: new Date('2024-01-01'),
              },
            },
            {
              tramo: 'T3',
              valor: 200000,
              vigencia: {
                desde: new Date('2024-01-01'),
              },
            },
          ],
        }),
      };

      configurePricing({ repository: mockRepository as any });

      const resultado = await PricingService.calculatePrecioBase({
        convenioId: 'FNS012',
        pesoRelativo: 1.0, // Debe caer en T1
      });

      expect(resultado.convenioId).toBe('FNS012');
      expect(resultado.tipo).toBe(ConvenioTipo.POR_TRAMOS);
      expect(resultado.tramoId).toBe('T1');
      expect(resultado.valor).toBe(100000);
      expect(resultado.tramo?.etiqueta).toContain('0 ≤ peso ≤ 1.5');
    });

    it('debe calcular precio por tramos T2 correctamente', async () => {
      const mockRepository = {
        findByConvenioId: jest.fn().mockResolvedValue({
          convenioId: 'FNS012',
          tipo: ConvenioTipo.POR_TRAMOS,
          precios: [
            {
              tramo: 'T1',
              valor: 100000,
              vigencia: {},
            },
            {
              tramo: 'T2',
              valor: 150000,
              vigencia: {},
            },
            {
              tramo: 'T3',
              valor: 200000,
              vigencia: {},
            },
          ],
        }),
      };

      configurePricing({ repository: mockRepository as any });

      const resultado = await PricingService.calculatePrecioBase({
        convenioId: 'FNS012',
        pesoRelativo: 2.0, // Debe caer en T2
      });

      expect(resultado.tramoId).toBe('T2');
      expect(resultado.valor).toBe(150000);
      expect(resultado.tramo?.etiqueta).toContain('1.5 < peso ≤ 2.5');
    });

    it('debe calcular precio por tramos T3 correctamente', async () => {
      const mockRepository = {
        findByConvenioId: jest.fn().mockResolvedValue({
          convenioId: 'FNS012',
          tipo: ConvenioTipo.POR_TRAMOS,
          precios: [
            {
              tramo: 'T1',
              valor: 100000,
              vigencia: {},
            },
            {
              tramo: 'T2',
              valor: 150000,
              vigencia: {},
            },
            {
              tramo: 'T3',
              valor: 200000,
              vigencia: {},
            },
          ],
        }),
      };

      configurePricing({ repository: mockRepository as any });

      const resultado = await PricingService.calculatePrecioBase({
        convenioId: 'FNS012',
        pesoRelativo: 3.0, // Debe caer en T3
      });

      expect(resultado.tramoId).toBe('T3');
      expect(resultado.valor).toBe(200000);
      expect(resultado.tramo?.etiqueta).toContain('peso > 2.5');
    });

    it('debe manejar límite T1 en 1.5 correctamente', async () => {
      const mockRepository = {
        findByConvenioId: jest.fn().mockResolvedValue({
          convenioId: 'FNS012',
          tipo: ConvenioTipo.POR_TRAMOS,
          precios: [
            {
              tramo: 'T1',
              valor: 100000,
              vigencia: {},
            },
            {
              tramo: 'T2',
              valor: 150000,
              vigencia: {},
            },
          ],
        }),
      };

      configurePricing({ repository: mockRepository as any });

      const resultado = await PricingService.calculatePrecioBase({
        convenioId: 'FNS012',
        pesoRelativo: 1.5, // Límite de T1, debe caer en T1
      });

      expect(resultado.tramoId).toBe('T1');
      expect(resultado.valor).toBe(100000);
    });

    it('debe manejar límite T2 en 2.5 correctamente', async () => {
      const mockRepository = {
        findByConvenioId: jest.fn().mockResolvedValue({
          convenioId: 'FNS012',
          tipo: ConvenioTipo.POR_TRAMOS,
          precios: [
            {
              tramo: 'T1',
              valor: 100000,
              vigencia: {},
            },
            {
              tramo: 'T2',
              valor: 150000,
              vigencia: {},
            },
            {
              tramo: 'T3',
              valor: 200000,
              vigencia: {},
            },
          ],
        }),
      };

      configurePricing({ repository: mockRepository as any });

      const resultado = await PricingService.calculatePrecioBase({
        convenioId: 'FNS012',
        pesoRelativo: 2.5, // Límite de T2, debe caer en T2
      });

      expect(resultado.tramoId).toBe('T2');
      expect(resultado.valor).toBe(150000);
    });

    it('debe lanzar ConvenioNoDisponibleError cuando el convenio no existe', async () => {
      const mockRepository = {
        findByConvenioId: jest.fn().mockResolvedValue(undefined),
      };

      configurePricing({ repository: mockRepository as any });

      await expect(
        PricingService.calculatePrecioBase({
          convenioId: 'NOEXISTE',
          pesoRelativo: 1.0,
        }),
      ).rejects.toThrow(ConvenioNoDisponibleError);
    });

    it('debe lanzar PesoRelativoInvalidoError cuando el peso es inválido', async () => {
      await expect(
        PricingService.calculatePrecioBase({
          convenioId: 'CH0041',
          pesoRelativo: 0,
        }),
      ).rejects.toThrow(PesoRelativoInvalidoError);

      await expect(
        PricingService.calculatePrecioBase({
          convenioId: 'CH0041',
          pesoRelativo: -1,
        }),
      ).rejects.toThrow(PesoRelativoInvalidoError);
    });

    it('debe lanzar TarifaFueraDeVigenciaError cuando no hay tarifas vigentes', async () => {
      const mockRepository = {
        findByConvenioId: jest.fn().mockResolvedValue({
          convenioId: 'CH0041',
          tipo: ConvenioTipo.PRECIO_UNICO,
          precios: [
            {
              valor: 150000,
              vigencia: {
                desde: new Date('2024-01-01'),
                hasta: new Date('2024-02-01'),
              },
            },
          ],
        }),
      };

      configurePricing({ repository: mockRepository as any });

      await expect(
        PricingService.calculatePrecioBase({
          convenioId: 'CH0041',
          pesoRelativo: 1.0,
          fechaReferencia: new Date('2024-12-31'), // Fuera de vigencia
        }),
      ).rejects.toThrow(TarifaFueraDeVigenciaError);
    });

    it('debe usar fechaReferencia cuando se proporciona', async () => {
      const mockRepository = {
        findByConvenioId: jest.fn().mockResolvedValue({
          convenioId: 'CH0041',
          tipo: ConvenioTipo.PRECIO_UNICO,
          precios: [
            {
              valor: 150000,
              vigencia: {
                desde: new Date('2024-01-01'),
                hasta: new Date('2024-12-31'),
              },
            },
          ],
        }),
      };

      configurePricing({ repository: mockRepository as any });

      const fechaReferencia = new Date('2024-06-15');
      const resultado = await PricingService.calculatePrecioBase({
        convenioId: 'CH0041',
        pesoRelativo: 1.0,
        fechaReferencia,
      });

      expect(resultado.valor).toBe(150000);
      expect(resultado.vigencia?.desde).toBeDefined();
    });
  });
});

