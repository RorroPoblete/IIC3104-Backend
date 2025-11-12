# Flujo del Cálculo Integral de Episodios GRD (V1)

## 📋 Resumen del Flujo

El cálculo integral de un episodio sigue estos pasos:

1. **Cargar episodio** → Validar que tiene norma MINSAL
2. **Determinar convenio** → Leer `conveniosCod` del episodio
3. **Obtener IR** → Usar `pesoTotalNorma` (campo vigente)
4. **Calcular precio base** → Invocar servicio de Pricing con convenio e IR
5. **Calcular subtotal** → `Precio Base × IR`
6. **Total final** → En V1, es igual al subtotal
7. **Persistir** → Guardar como nueva versión con breakdown completo

---

## 🔍 Paso a Paso Detallado

### Paso 1: Cargar Episodio Normalizado

```typescript
const episodio = await prisma.normalizedData.findUnique({
  where: { id: episodioId }
```

**Campos importantes del episodio:**
- `tieneNorma`: Debe ser `true` (episodio enriquecido con Norma MINSAL)
- `conveniosCod`: Código del convenio (ej: "FNS012", "CON001", "CH0041")
- `pesoTotalNorma`: IR/Peso relativo a usar en el cálculo
- `irGrdCodigo` o `irGrd`: Código GRD del episodio

**Validación:**
- Si `tieneNorma === false` → Error: "El episodio no tiene norma MINSAL asociada"

---

### Paso 2: Determinar Convenio

```typescript
const convenioId = episodio.conveniosCod;
```

**Mapeo desde CSV:**
- El CSV tiene la columna **"Convenios Código"** (o variaciones como "Convenios (cod)")
- Se normaliza y se guarda en `conveniosCod` del episodio
- El código se usa tal cual viene del CSV (ej: "CON001", "FNS012")

**Validación:**
- Si `conveniosCod` está vacío o null → Error: "El episodio no tiene convenio asociado"

**⚠️ IMPORTANTE:** El convenio debe existir en el archivo de pricing activo.

---

### Paso 3: Obtener IR (Peso Relativo)

```typescript
const ir = episodio.pesoTotalNorma;
```

**Campo usado:**
- `pesoTotalNorma`: Este es el campo vigente para el IR
- Viene del enriquecimiento con Norma MINSAL
- Debe ser un número > 0

**Validación:**
- Si `pesoTotalNorma` es null, undefined o ≤ 0 → Error: "El episodio no tiene IR válido"

---

### Paso 4: Calcular Precio Base

```typescript
const precioBaseResult = await PricingService.calculatePrecioBase({
  convenioId: convenioId.trim(),
  pesoRelativo: ir,
  fechaReferencia: fechaReferencia ? new Date(fechaReferencia) : undefined
});
```

**Qué hace el servicio de Pricing:**
1. Busca el archivo de pricing activo
2. Busca tarifas del convenio en ese archivo
3. Si el convenio es FNS012/FNS026 (por tramos):
   - Determina el tramo según el IR:
     - **T1**: 0 ≤ IR ≤ 1.5
     - **T2**: 1.5 < IR ≤ 2.5
     - **T3**: IR > 2.5
   - Selecciona la tarifa del tramo correspondiente
4. Si el convenio es precio único (ej: CH0041):
   - Selecciona la tarifa única del convenio
5. Valida vigencia (si hay fechaReferencia)
6. Retorna el precio base

**Errores posibles:**
- `ConvenioNoDisponibleError`: El convenio no existe en el archivo de pricing activo
- `PesoRelativoInvalidoError`: El IR es inválido
- `TarifaFueraDeVigenciaError`: No hay tarifas vigentes para la fecha
- `TarifaSourceUnavailableError`: No hay archivo de pricing activo

---

### Paso 5: Calcular Subtotal

```typescript
const subtotal = calcSubtotal(precioBase, ir);
// subtotal = precioBase × ir (redondeado a 2 decimales)
```

**Función:**
```typescript
export function calcSubtotal(precioBase: number, ir: number): number {
  const subtotal = precioBase * ir;
  return Math.round(subtotal * 100) / 100; // Redondeo a 2 decimales
}
```

---

### Paso 6: Total Final (V1)

```typescript
const totalFinal = subtotal; // En V1, es igual al subtotal
```

**Nota:** En V2 se agregarán:
- AT (Ajuste por Tecnología)
- Días de espera
- Outlier
- Carencia

---

### Paso 7: Persistir Cálculo

Se guarda en `CalculoEpisodio` con:
- `episodioId`: ID del episodio
- `version`: Número incremental (1, 2, 3...)
- `convenio`: Código del convenio usado
- `grd`: Código GRD
- `precioBase`: Precio base calculado
- `ir`: IR usado
- `subtotal`: Subtotal calculado
- `totalFinal`: Total final
- `breakdown`: JSON completo con toda la información
- `normaFileId`: ID del archivo de norma usado
- `pricingFileId`: ID del archivo de pricing usado
- `usuario`: Usuario que ejecutó el cálculo

---

## 🐛 Debugging: "Convenio CON001 no disponible"

### Problema Común

El error **"Convenio CON001 no disponible en las tarifas activas"** significa que:

1. El episodio tiene `conveniosCod = "CON001"`
2. El servicio de Pricing no encuentra ese convenio en el archivo de pricing activo

### Cómo Verificar

#### 1. Verificar el convenio del episodio

```sql
-- En la base de datos
SELECT id, "conveniosCod", "conveniosDesc", "tieneNorma", "pesoTotalNorma"
FROM normalized_data
WHERE id = 'episodio_id_aqui';
```

O desde la API:
```bash
GET /api/codification/import/batches/{batchId}/data
# Busca el episodio y verifica el campo "conveniosCod"
```

#### 2. Verificar qué convenios hay en pricing

```bash
# Ver archivo activo
GET /api/pricing/import/active

# Ver todas las tarifas del archivo activo
GET /api/pricing/import/files/{fileId}/data

# Buscar un convenio específico
GET /api/pricing/prices/CON001
```

#### 3. Verificar el mapeo desde CSV

El CSV puede tener la columna como:
- "Convenios Código"
- "Convenios (cod)"
- "Convenios cod"
- etc.

El código ahora busca múltiples variaciones, pero si el nombre es muy diferente, puede no encontrarlo.

**Verificar en logs:**
```bash
# Ver logs del backend al importar
docker compose logs backend | grep "Convenios"
```

#### 4. Verificar normalización del header

El parser normaliza headers con:
```typescript
header.normalize('NFKC').replace(/\s+/g, ' ').trim()
```

Esto significa:
- "Convenios Código" → "Convenios Código"
- "Convenios (cod)" → "Convenios (cod)"
- "Convenios  Código" (doble espacio) → "Convenios Código"

---

## 🔧 Soluciones

### Solución 1: El convenio no existe en pricing

**Problema:** El convenio "CON001" no está en el archivo de pricing.

**Solución:**
1. Verifica que el archivo de pricing tenga ese convenio
2. Si no está, agrégalo al archivo Excel/CSV
3. Vuelve a subir el archivo de pricing
4. Actívalo

### Solución 2: Nombre de columna diferente

**Problema:** El CSV tiene "Convenios Código" pero el código busca "Convenios (cod)".

**Solución:** Ya está corregido. El código ahora busca múltiples variaciones:
- "Convenios (cod)"
- "Convenios Código"
- "Convenios cod"
- "Convenios Cod"
- "Convenios(cod)"
- "Convenios Codigo"

Si tu CSV tiene otro nombre, agrégalo a la lista en `dataNormalizer.ts`.

### Solución 3: Espacios o caracteres especiales

**Problema:** El convenio tiene espacios extra o caracteres especiales.

**Solución:** El código hace `.trim()` del convenio antes de usarlo. Si aún hay problemas, verifica:
- Espacios al inicio/final
- Caracteres invisibles
- Encoding del CSV

### Solución 4: Case sensitivity

**Problema:** El convenio en el CSV es "con001" pero en pricing es "CON001".

**Solución:** El servicio de Pricing busca el convenio tal cual viene. Asegúrate de que:
- El convenio en el CSV coincida exactamente con el de pricing
- O normaliza ambos a mayúsculas/minúsculas

---

## 📊 Logs para Debugging

El servicio ahora registra logs detallados:

```typescript
logger.info('[CalculoService] Determinando convenio', {
  episodioId,
  convenioIdRaw: convenioId,
  convenioIdTrimmed,
});

logger.info('[CalculoService] Calculando precio base', {
  convenioId: convenioIdTrimmed,
  pesoRelativo: ir,
  fechaReferencia: fechaReferencia ? new Date(fechaReferencia).toISOString() : undefined,
});

logger.error('[CalculoService] Convenio no disponible', {
  episodioId,
  convenioId: convenioIdTrimmed,
  precioFileId: pricingFile.id,
  precioFileName: pricingFile.filename,
});
```

**Ver logs:**
```bash
docker compose logs backend | grep CalculoService
```

---

## ✅ Checklist de Verificación

Antes de calcular un episodio, verifica:

- [ ] El episodio tiene `tieneNorma === true`
- [ ] El episodio tiene `conveniosCod` con valor
- [ ] El episodio tiene `pesoTotalNorma` > 0
- [ ] Hay un archivo de pricing activo
- [ ] El convenio existe en el archivo de pricing activo
- [ ] El convenio tiene tarifas vigentes (si se usa fechaReferencia)
- [ ] El nombre de la columna en el CSV es reconocido

---

## 🎯 Ejemplo de Cálculo Exitoso

```
Episodio: ep_123
Convenio: FNS012
IR: 2.1
Precio Base (T2): $150,000
Subtotal: $150,000 × 2.1 = $315,000
Total Final: $315,000
```

---

## 📝 Notas Importantes

1. **El IR usado es `pesoTotalNorma`**, no otros campos como `pesoGrdMedio`
2. **El convenio se busca exactamente** como viene en el CSV (case-sensitive)
3. **Cada recalculo crea una nueva versión** (no sobrescribe)
4. **El archivo de pricing debe estar activo** para que funcione
5. **Los tramos se determinan automáticamente** según el IR para FNS012/FNS026

