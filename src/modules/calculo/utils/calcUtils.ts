/**
 * Utilidades para cálculos de episodios GRD
 */

/**
 * Calcula el subtotal multiplicando precio base por IR
 * @param precioBase - Precio base del convenio
 * @param ir - Peso relativo/IR del episodio
 * @returns Subtotal calculado (redondeado a 2 decimales)
 */
export function calcSubtotal(precioBase: number, ir: number): number {
  if (!Number.isFinite(precioBase) || precioBase < 0) {
    throw new Error('El precio base debe ser un número válido mayor o igual a 0');
  }
  if (!Number.isFinite(ir) || ir <= 0) {
    throw new Error('El IR debe ser un número válido mayor que 0');
  }

  const subtotal = precioBase * ir;
  // Redondear a 2 decimales
  return Math.round(subtotal * 100) / 100;
}


