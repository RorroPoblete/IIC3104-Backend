# Módulo de Pricing

Este módulo gestiona la importación, almacenamiento y cálculo de precios base GRD según convenios y tramos.

## Funcionalidad

El módulo permite:

1. **Subir archivos CSV o Excel** de tarifas de convenios GRD
2. **Almacenar las tarifas** en la base de datos de forma estructurada
3. **Gestionar múltiples archivos** y activar uno para uso activo
4. **Calcular precio base** según convenio y peso relativo del episodio
5. **Soportar convenios con precio único y por tramos** (FNS012/FNS026)

## Estructura del Módulo

```
pricing/
├── routes/
│   └── pricing.ts           # Endpoints REST
├── repositories/
│   └── prismaPricingRepository.ts  # Implementación del repositorio Prisma
├── services/
│   └── pricingService.ts    # Servicio de cálculo de precio base
└── utils/
    └── pricingParser.ts     # Parser de archivos CSV/Excel
```

## Modelos de Base de Datos

### PricingFile
Representa un archivo subido de tarifas.

Campos:
- `id`: Identificador único
- `filename`: Nombre del archivo original
- `description`: Descripción opcional del archivo
- `status`: Estado de la importación (PENDING, PROCESSING, COMPLETED, FAILED, PARTIALLY_COMPLETED)
- `totalRows`: Total de filas en el archivo
- `processedRows`: Filas procesadas exitosamente
- `errorRows`: Filas con errores
- `isActive`: Indica si es el archivo activo (solo uno puede estarlo)
- `createdAt`: Fecha de creación
- `updatedAt`: Fecha de actualización
- `completedAt`: Fecha de completado

### PricingTarifa
Representa una tarifa individual de un convenio.

Campos principales:
- `id`: Identificador único
- `fileId`: ID del archivo al que pertenece
- `convenioId`: Código del convenio (ej: "FNS012", "CH0041")
- `descripcionConvenio`: Descripción del convenio
- `tramo`: Tramo de la tarifa (T1, T2, T3) o null para precio único
- `precio`: Valor de la tarifa
- `fechaAdmision`: Fecha de inicio de vigencia
- `fechaFin`: Fecha de fin de vigencia
- `rawData`: Datos completos de la fila en formato JSON

## API Endpoints

### POST /api/pricing/import
Sube un nuevo archivo CSV o Excel de tarifas.

**Request:**
- Method: POST
- Content-Type: multipart/form-data
- Body:
  - `file`: Archivo CSV o Excel (.csv, .xlsx, .xls) (requerido)
  - `description`: Descripción del archivo (opcional)

**Response:**
```json
{
  "success": true,
  "message": "Importación de tarifas completada",
  "data": {
    "fileId": "clxxx",
    "processedRows": 100,
    "errorRows": 0,
    "totalRows": 100,
    "status": "COMPLETED"
  }
}
```

### GET /api/pricing/import/files
Lista todos los archivos de tarifas cargados.

**Query Parameters:**
- `page`: Número de página (default: 1)
- `limit`: Elementos por página (default: 10)

### GET /api/pricing/import/files/:id
Obtiene detalles de un archivo específico.

### GET /api/pricing/import/files/:id/data
Obtiene todas las tarifas de un archivo con paginación.

**Query Parameters:**
- `page`: Número de página (default: 1)
- `limit`: Elementos por página (default: 100)

### PATCH /api/pricing/import/files/:id/activate
Activa un archivo para ser usado en los cálculos. Solo un archivo puede estar activo a la vez.

### GET /api/pricing/import/active
Obtiene el archivo activo actual.

### GET /api/pricing/prices/:convenioId
Obtiene las tarifas de un convenio específico.

**Query Parameters:**
- `fileId`: ID del archivo a consultar (opcional, usa el activo si no se especifica)
- `tramo`: Filtro por tramo (T1, T2, T3) (opcional)

### GET /api/pricing/calculate
Calcula el precio base para un convenio y peso relativo dados.

**Query Parameters:**
- `convenioId`: Código del convenio (requerido, ej: "FNS012", "CH0041")
- `pesoRelativo`: Peso relativo del episodio (requerido, número > 0)
- `fechaReferencia`: Fecha de referencia para validar vigencia (opcional, formato ISO 8601)

**Response:**
```json
{
  "success": true,
  "data": {
    "convenioId": "FNS012",
    "tipo": "POR_TRAMOS",
    "valor": 150000,
    "fuente": "db",
    "tramoId": "T2",
    "tramo": {
      "id": "T2",
      "etiqueta": "1.5 < peso ≤ 2.5",
      "min": 1.5,
      "max": 2.5,
      "incluyeMin": false,
      "incluyeMax": true
    },
    "vigencia": {
      "desde": "2024-01-01T00:00:00.000Z",
      "hasta": "2024-12-31T23:59:59.999Z"
    }
  }
}
```

**Errores:**
- `400`: Peso relativo inválido o parámetros faltantes
- `404`: Convenio no disponible o tarifa fuera de vigencia
- `503`: No hay fuentes de tarifas configuradas

**Ejemplo de uso:**
```bash
# Calcular precio para convenio FNS012 con peso 2.1
GET /api/pricing/calculate?convenioId=FNS012&pesoRelativo=2.1

# Calcular precio para convenio CH0041 con precio único
GET /api/pricing/calculate?convenioId=CH0041&pesoRelativo=1.0

# Calcular precio con fecha de referencia específica
GET /api/pricing/calculate?convenioId=FNS012&pesoRelativo=2.1&fechaReferencia=2024-06-15
```

## Cálculo de Precio Base

El módulo soporta dos tipos de convenios:

### Precio Único
Convenios que tienen un precio fijo independiente del peso relativo (ej: CH0041).

### Por Tramos
Convenios que tienen diferentes precios según el peso relativo del episodio (ej: FNS012, FNS026).

**Tramos:**
- **T1**: 0 ≤ peso ≤ 1.5
- **T2**: 1.5 < peso ≤ 2.5
- **T3**: peso > 2.5

**Límites:**
- Peso = 1.5 → T1
- Peso = 2.5 → T2
- Peso > 2.5 → T3

## Integración con el Motor de Reglas

El módulo utiliza el motor de reglas en `packages/rules/pricing.ts` que:

1. Busca tarifas en la base de datos (archivo activo) primero
2. Si no encuentra, busca en el archivo adjunto `Precios convenios GRD.xlsx`
3. Selecciona la tarifa vigente según la fecha de referencia
4. Determina el tramo correcto según el peso relativo
5. Retorna el precio base calculado

## Uso desde el Frontend

### Calcular Precio Base

```javascript
const response = await fetch(
  '/api/pricing/calculate?convenioId=FNS012&pesoRelativo=2.1'
);
const { data } = await response.json();

// data.valor contiene el precio base calculado
// data.tramoId contiene el tramo aplicado (si es por tramos)
// data.fuente indica si vino de BD ('db') o archivo adjunto ('attachment')
```

### Manejo de Errores

```javascript
try {
  const response = await fetch(
    '/api/pricing/calculate?convenioId=FNS012&pesoRelativo=2.1'
  );
  const result = await response.json();
  
  if (!result.success) {
    switch (result.error) {
      case 'CONVENIO_NO_DISPONIBLE':
        // El convenio no existe en las tarifas
        break;
      case 'PESO_RELATIVO_INVALIDO':
        // El peso relativo es inválido
        break;
      case 'TARIFA_FUERA_DE_VIGENCIA':
        // No hay tarifas vigentes para la fecha
        break;
      case 'TARIFA_SOURCE_UNAVAILABLE':
        // No hay fuentes de tarifas configuradas
        break;
    }
  }
} catch (error) {
  // Error de conexión
}
```

## Consideraciones

- Solo un archivo puede estar activo a la vez
- Los datos se procesan en lotes de 500 filas para optimizar memoria
- Los archivos temporales se eliminan automáticamente después del procesamiento
- Todas las tarifas se almacenan en PostgreSQL para consultas rápidas
- Se mantiene el `rawData` completo para flexibilidad futura
- Los índices en `convenioId` y `fileId` optimizan las consultas
- El cálculo de precio base valida vigencias y selecciona automáticamente el tramo correcto

