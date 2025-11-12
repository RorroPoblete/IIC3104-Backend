# Módulo de Cálculo Integral de Episodios GRD

Este módulo implementa el cálculo integral de episodios GRD (Versión 1), incluyendo versionado y auditoría.

## Funcionalidad V1

El módulo calcula el precio integral de un episodio usando:

1. **Precio Base**: Obtenido del módulo de Pricing (activo)
2. **IR (Peso Relativo)**: Usa el campo `pesoTotalNorma` del episodio enriquecido
3. **Subtotal**: `PrecioBase × IR`
4. **Total Final**: En V1, es igual al subtotal (sin AT, días de espera, outlier, carencia)

## Estructura del Módulo

```
calculo/
├── routes/
│   └── calculo.ts           # Endpoints REST
├── services/
│   └── calculoService.ts    # Lógica de cálculo y versionado
├── utils/
│   └── calcUtils.ts         # Utilidades de cálculo (calcSubtotal)
└── __tests__/
    └── calcUtils.test.ts    # Pruebas unitarias
```

## Modelos de Base de Datos

### CalculoEpisodio
Almacena cada ejecución de cálculo como una versión.

Campos principales:
- `episodioId`: ID del episodio normalizado
- `version`: Número de versión (incremental)
- `convenio`: Código del convenio
- `grd`: Código GRD
- `precioBase`: Precio base calculado
- `ir`: Peso relativo/IR usado
- `subtotal`: Subtotal calculado
- `totalFinal`: Total final (V1 = subtotal)
- `breakdown`: JSON con el breakdown completo
- `normaFileId`: ID del archivo activo de norma usado
- `pricingFileId`: ID del archivo activo de pricing usado
- `usuario`: Usuario que ejecutó el cálculo

### CalculoAuditoria
Registra eventos de auditoría.

Campos principales:
- `evento`: Tipo de evento (ej: "Recalcular episodio (V1)")
- `episodioId`: ID del episodio relacionado
- `calculoId`: ID del cálculo relacionado
- `usuario`: Usuario que ejecutó la acción
- `totalFinal`: Total final del cálculo
- `fuentes`: Información de fuentes usadas (JSON)

## API Endpoints

### POST /api/calculo/episodio/:id/run
Ejecuta el cálculo integral de un episodio.

**Request:**
- Method: POST
- Path: `/api/calculo/episodio/:id/run`
- Body (JSON):
  ```json
  {
    "fechaReferencia": "2024-06-15T00:00:00.000Z", // Opcional, ISO 8601
    "usuario": "user@example.com" // Opcional
  }
  ```

**Response:**
```json
{
  "success": true,
  "message": "Cálculo completado exitosamente",
  "data": {
    "calculoId": "clxxx",
    "version": 1,
    "breakdown": {
      "episodioId": "ep_xxx",
      "convenio": "FNS012",
      "grd": "123",
      "precioBase": 150000,
      "ir": 1.5,
      "subtotal": 225000,
      "totalFinal": 225000,
      "fuentes": {
        "norma": "norma minsal.xlsx",
        "pricing": "Precios convenios GRD.xlsx"
      }
    },
    "totalFinal": 225000
  }
}
```

**Errores:**
- `404 EPISODIO_NO_ENCONTRADO`: El episodio no existe
- `400 EPISODIO_SIN_NORMA`: El episodio no tiene norma MINSAL (`tieneNorma === false`)
- `400 EPISODIO_SIN_CONVENIO`: El episodio no tiene convenio asociado
- `400 EPISODIO_SIN_IR`: El episodio no tiene IR válido
- `503 PRICING_FILE_UNAVAILABLE`: No hay archivo activo de pricing
- `404 CONVENIO_NO_DISPONIBLE`: El convenio no existe en las tarifas
- `404 TARIFA_FUERA_DE_VIGENCIA`: No hay tarifas vigentes para la fecha
- `503 TARIFA_SOURCE_UNAVAILABLE`: No hay fuentes de tarifas configuradas

### GET /api/calculo/episodio/:id/versiones
Obtiene el historial de versiones de cálculo para un episodio.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "calc_xxx",
      "version": 2,
      "totalFinal": 225000,
      "fecha": "2024-06-15T10:30:00.000Z",
      "usuario": "user@example.com",
      "convenio": "FNS012",
      "grd": "123"
    },
    {
      "id": "calc_yyy",
      "version": 1,
      "totalFinal": 200000,
      "fecha": "2024-06-14T15:20:00.000Z",
      "usuario": "user@example.com",
      "convenio": "FNS012",
      "grd": "123"
    }
  ]
}
```

### GET /api/calculo/version/:id
Obtiene el detalle completo de un cálculo específico.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "calc_xxx",
    "episodioId": "ep_xxx",
    "version": 1,
    "breakdown": {
      "episodioId": "ep_xxx",
      "convenio": "FNS012",
      "grd": "123",
      "precioBase": 150000,
      "ir": 1.5,
      "subtotal": 225000,
      "totalFinal": 225000,
      "fuentes": {
        "norma": "norma minsal.xlsx",
        "pricing": "Precios convenios GRD.xlsx"
      }
    },
    "totalFinal": 225000,
    "fechaReferencia": "2024-06-15T00:00:00.000Z",
    "createdAt": "2024-06-15T10:30:00.000Z",
    "usuario": "user@example.com",
    "fuentes": {
      "norma": {
        "id": "norma_xxx",
        "filename": "norma minsal.xlsx"
      },
      "pricing": {
        "id": "pricing_xxx",
        "filename": "Precios convenios GRD.xlsx"
      }
    }
  }
}
```

## Flujo del Cálculo

1. **Cargar episodio**: Se obtiene el episodio normalizado por ID
2. **Validar norma**: Se verifica que `tieneNorma === true`
3. **Determinar convenio**: Se usa el campo `conveniosCod` del episodio
4. **Obtener IR**: Se usa `pesoTotalNorma` (campo vigente para IR)
5. **Calcular precio base**: Se invoca el servicio de Pricing con el convenio e IR
6. **Calcular subtotal**: `precioBase × IR`
7. **Total final**: En V1, es igual al subtotal
8. **Persistir**: Se guarda como nueva versión con breakdown completo
9. **Auditoría**: Se registra el evento "Recalcular episodio (V1)"

## Orden de Evaluación

1. Validación de episodio y norma
2. Obtención de convenio e IR
3. Validación de archivos activos (norma y pricing)
4. Cálculo de precio base (con validación de tramos para FNS012/FNS026)
5. Cálculo de subtotal
6. Persistencia y auditoría

## Campos que Intervienen en V1

- **Episodio**: `id`, `tieneNorma`, `conveniosCod`, `pesoTotalNorma`, `irGrdCodigo`, `irGrd`
- **Norma MINSAL**: Archivo activo (para tracking)
- **Pricing**: Archivo activo (para cálculo de precio base)

## Fuentes Activas

- **Norma MINSAL**: Archivo con `isActive: true` y `status: 'COMPLETED'`
- **Pricing**: Archivo con `isActive: true` y `status: 'COMPLETED'`

## Tramos FNS012/FNS026

Los convenios FNS012 y FNS026 usan tramos según el IR:
- **T1**: 0 ≤ IR ≤ 1.5
- **T2**: 1.5 < IR ≤ 2.5
- **T3**: IR > 2.5

El servicio de Pricing selecciona automáticamente el tramo correcto.

## Consideraciones

- Cada recalculo crea una nueva versión (no sobrescribe)
- El versionado es incremental por episodio
- La auditoría registra cada ejecución
- Los errores son tipados y controlados
- No se rompen rutas ni contratos existentes
- V2 añadirá: AT, días de espera, outlier, carencia

