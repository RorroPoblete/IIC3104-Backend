import { calcSubtotal } from '../utils/calcUtils';

describe('calcSubtotal', () => {
  it('debe calcular correctamente el subtotal', () => {
    expect(calcSubtotal(100000, 1.5)).toBe(150000);
    expect(calcSubtotal(200000, 2.5)).toBe(500000);
    expect(calcSubtotal(150000, 1.0)).toBe(150000);
  });

  it('debe redondear correctamente a 2 decimales', () => {
    expect(calcSubtotal(100000, 1.333)).toBe(133300);
    expect(calcSubtotal(100000, 1.666)).toBe(166600);
    expect(calcSubtotal(100000, 1.999)).toBe(199900);
  });

  it('debe lanzar error si precioBase es inválido', () => {
    expect(() => calcSubtotal(-100, 1.5)).toThrow('precio base');
    expect(() => calcSubtotal(NaN, 1.5)).toThrow('precio base');
    expect(() => calcSubtotal(Infinity, 1.5)).toThrow('precio base');
  });

  it('debe lanzar error si IR es inválido', () => {
    expect(() => calcSubtotal(100000, -1)).toThrow('IR');
    expect(() => calcSubtotal(100000, 0)).toThrow('IR');
    expect(() => calcSubtotal(100000, NaN)).toThrow('IR');
    expect(() => calcSubtotal(100000, Infinity)).toThrow('IR');
  });

  it('debe manejar correctamente precioBase = 0', () => {
    expect(calcSubtotal(0, 1.5)).toBe(0);
  });
});


