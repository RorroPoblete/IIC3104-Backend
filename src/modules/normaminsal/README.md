# Módulo Norma Minsal

Este módulo gestiona la importación, almacenamiento y consulta de archivos de Norma Minsal en formato CSV.

## Funcionalidad

El módulo permite:

1. **Subir archivos CSV** de Norma Minsal al servidor
2. **Almacenar los datos** en la base de datos de forma estructurada
3. **Consultar los datos** por número de episodio
4. **Gestionar múltiples archivos** y activar uno para uso activo
5. **Hacer matching** entre números de episodio y datos de norma para calcular precios de atención

## Estructura del Módulo

```
normaminsal/
├── routes/
│   └── normaminsal.ts       # Endpoints REST
└── utils/
    ├── csvParser.ts          # Parser de archivos CSV
    └── dataNormalizer.ts     # Normalización de datos
```

## Modelos de Base de Datos

### NormaMinsalFile
Representa un archivo subido de Norma Minsal.

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

### NormaMinsalData
Representa los datos de cada fila del CSV.

Campos principales basados en el formato real del CSV de Norma Minsal:
- `grd`: Código GRD (campo principal para hacer matching con episodios)
- `tipoGrd`: Tipo de GRD
- `gravedad`: Nivel de gravedad (1, 2, 3, etc.)
- `totalAltas`: Total de altas
- `totalEst`: Total de estancias
- `estMedia`: Estancia media
- `altasDepu`: Altas depuradas
- `totalEstDepu`: Total estancias depuradas
- `estMediaDepuG`: Estancia media depurada por gravedad
- `numOutInfG`: Número de outliers inferiores
- `nOutliersSup`: Número de outliers superiores
- `exitus`: Número de fallecimientos
- `percentil25`: Percentil 25
- `percentil50`: Percentil 50 (mediana)
- `percentil75`: Percentil 75
- `puntoCorteInferior`: Punto de corte inferior
- `puntoCorteSuperior`: Punto de corte superior
- `pesoTotal`: Peso total
- `pesoTotalDepu`: Peso total depurado
- `rawData`: Datos completos de la fila en formato JSON

## API Endpoints

### POST /api/normaminsal/import/csv
Sube un nuevo archivo CSV de Norma Minsal.

**Request:**
- Method: POST
- Content-Type: multipart/form-data
- Body:
  - `file`: Archivo CSV (requerido)
  - `description`: Descripción del archivo (opcional)

**Response:**
```json
{
  "success": true,
  "message": "Importación de Norma Minsal completada",
  "data": {
    "fileId": "clxxx",
    "totalRows": 1000,
    "processedRows": 1000,
    "errorRows": 0,
    "status": "COMPLETED",
    "parseErrors": []
  }
}
```

### GET /api/normaminsal/import/batches
Lista todos los lotes de Norma Minsal.

**Query Parameters:**
- `page`: Número de página (default: 1)
- `limit`: Elementos por página (default: 10)

**Response:**
```json
{
  "success": true,
  "data": {
    "batches": [...],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 5,
      "pages": 1
    }
  }
}
```

### GET /api/normaminsal/import/batches/:id
Obtiene detalles de un lote específico.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "clxxx",
    "filename": "norma_minsal_2024.csv",
    "description": "Norma Minsal 2024",
    "status": "COMPLETED",
    "totalRows": 1000,
    "processedRows": 1000,
    "errorRows": 0,
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "_count": {
      "data": 1000
    }
  }
}
```

### PATCH /api/normaminsal/import/batches/:id/activate
Activa un lote para ser usado en las consultas. Solo un lote puede estar activo a la vez.

**Response:**
```json
{
  "success": true,
  "message": "Lote activado correctamente",
  "data": {
    "batchId": "clxxx"
  }
}
```

### GET /api/normaminsal/import/active-batch
Obtiene el lote activo actual.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "clxxx",
    "filename": "norma_minsal_2024.csv",
    "isActive": true,
    ...
  }
}
```

### GET /api/normaminsal/import/batches/:id/data
Obtiene los datos de un lote específico con paginación.

**Query Parameters:**
- `page`: Número de página (default: 1)
- `limit`: Elementos por página (default: 100)

**Response:**
```json
{
  "success": true,
  "data": {
    "data": [...],
    "pagination": {
      "page": 1,
      "limit": 100,
      "total": 1000,
      "pages": 10
    }
  }
}
```

### GET /api/normaminsal/import/query/grd/:grdCode
Busca información de un GRD específico en el lote activo.

**URL Parameters:**
- `grdCode`: Código GRD a buscar (ej: "11011")

**Query Parameters:**
- `batchId`: ID del lote a consultar (opcional, usa el activo si no se especifica)
- `gravedad`: Nivel de gravedad específico (opcional, ej: "1", "2", "3")

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "clxxx",
    "fileId": "clyyy",
    "grd": "11011",
    "tipoGrd": "",
    "gravedad": "1",
    "totalAltas": 90,
    "totalEst": 1152,
    "estMedia": 12.8,
    "altasDepu": 85,
    "totalEstDepu": 936,
    "pesoTotal": 218.97,
    "pesoTotalDepu": 206.805,
    "percentil25": 5,
    "percentil50": 10.5,
    "percentil75": 17,
    "puntoCorteInferior": 0,
    "puntoCorteSuperior": 35,
    "rawData": {...},
    "file": {
      "id": "clyyy",
      "filename": "norma_minsal_2024.csv",
      "description": "Norma Minsal 2024"
    }
  }
}
```

**Ejemplo de uso:**
```bash
# Buscar GRD 11011 con cualquier gravedad
GET /api/normaminsal/import/query/grd/11011

# Buscar GRD 11011 con gravedad 1
GET /api/normaminsal/import/query/grd/11011?gravedad=1
```

### GET /api/normaminsal/import/query/grd/:grdCode/all
Obtiene todas las variantes de gravedad de un GRD específico.

**URL Parameters:**
- `grdCode`: Código GRD a buscar

**Query Parameters:**
- `batchId`: ID del lote a consultar (opcional, usa el activo si no se especifica)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "clxxx1",
      "grd": "11011",
      "gravedad": "1",
      "estMedia": 12.8,
      "pesoTotal": 218.97,
      ...
    },
    {
      "id": "clxxx2",
      "grd": "11011",
      "gravedad": "2",
      "estMedia": 22.4,
      "pesoTotal": 256.07,
      ...
    }
  ],
  "count": 2
}
```

### DELETE /api/normaminsal/import/batches/:id
Elimina un lote y todos sus datos asociados.

**Response:**
```json
{
  "success": true,
  "message": "Lote eliminado correctamente"
}
```

## Formato del CSV

El CSV de Norma Minsal debe tener el siguiente formato con las columnas exactas:

**Columnas requeridas:**
- `GRD`: Código GRD (REQUERIDO)
- `Tipo GRD`: Tipo de GRD
- `GRAVEDAD`: Nivel de gravedad
- `Total Altas`: Total de altas
- `Total Est`: Total de estancias
- `Est Media`: Estancia media
- `Altas Depu`: Altas depuradas
- `Total Est Depu`: Total estancias depuradas
- `TAB_1430_D_EST_MED_DEPU_G`: Estancia media depurada
- `TAB_1430_D_NUM_OUT_INF_G`: Número de outliers inferiores
- `N Outliers Sup`: Número de outliers superiores
- `Exitus`: Fallecimientos
- `Percentil 25`: Percentil 25
- `TAB_1430_D_PERCT_50_G`: Percentil 50
- `Percentil 75`: Percentil 75
- `Punto Corte Inferior`: Punto de corte inferior
- `Punto Corte Superior`: Punto de corte superior
- `Peso Total`: Peso total
- `Peso Total Depu`: Peso total depurado

**Ejemplo de datos:**
```
GRD;Tipo GRD;GRAVEDAD;Total Altas;Total Est;Est Media;...
11011;;1;90;1152;12.8;85;936;11.01;0;5;1;5;10.5;17;0;35;218.97;206.805
11012;;2;71;1593;22.44;69;1399;20.28;0;2;2;14;19;29;0;51;256.07;248.86
```

El parser:
- Usa `;` como separador
- Codificación Latin-1
- Normaliza los nombres de las columnas
- Almacena todos los datos en `rawData` para máxima flexibilidad

## Uso desde el Frontend

### Flujo de Trabajo

1. **Importar archivo CSV:**
   ```javascript
   const formData = new FormData();
   formData.append('file', csvFile);
   formData.append('description', 'Norma Minsal 2024');
   
   const response = await fetch('/api/normaminsal/import/csv', {
     method: 'POST',
     body: formData
   });
   ```

2. **Listar lotes disponibles:**
   ```javascript
   const response = await fetch('/api/normaminsal/import/batches');
   const { data } = await response.json();
   // Mostrar lista de lotes en un selector
   ```

3. **Activar un lote:**
   ```javascript
   await fetch(`/api/normaminsal/import/batches/${batchId}/activate`, {
     method: 'PATCH'
   });
   ```

4. **Consultar GRD de un episodio:**
   ```javascript
   // Primero obtener el GRD del episodio desde los datos de codificación
   const episodeGRD = '11011'; // Ej: obtenido de irGrdCodigo
   const gravedad = '1'; // Ej: obtenido de irGravedad
   
   // Buscar información en Norma Minsal
   const response = await fetch(`/api/normaminsal/import/query/grd/${episodeGRD}?gravedad=${gravedad}`);
   const { data } = await response.json();
   
   // Usar data.pesoTotal, data.pesoTotalDepu, etc. para calcular precio
   const precio = data.pesoTotal * valorBaseCalculado;
   ```

5. **Obtener todas las gravedades de un GRD:**
   ```javascript
   const response = await fetch(`/api/normaminsal/import/query/grd/11011/all`);
   const { data, count } = await response.json();
   // data es un array con todas las variantes de gravedad
   ```

## Consideraciones

- Solo un lote puede estar activo a la vez
- Los datos se procesan en lotes de 100 filas para optimizar memoria
- Los archivos temporales se eliminan automáticamente después del procesamiento
- Todos los datos se almacenan en PostgreSQL para consultas rápidas
- Se mantiene el `rawData` completo para flexibilidad futura
- Los índices en `grd` y `fileId` optimizan las consultas

## Integración con Módulo de Codificación

El matching entre episodios y la Norma Minsal se realiza mediante el código GRD:

1. En los datos de episodios (modelo `NormalizedData`), el campo `irGrdCodigo` contiene el código GRD
2. En los datos de Norma Minsal (modelo `NormaMinsalData`), el campo `grd` contiene el código GRD
3. El campo `irGravedad` del episodio puede usarse para filtrar la gravedad específica en Norma Minsal

**Ejemplo de matching:**
```javascript
// Obtener episodio
const episodio = await prisma.normalizedData.findUnique({
  where: { id: episodioId }
});

// Buscar en Norma Minsal
const normaMinsalData = await prisma.normaMinsalData.findFirst({
  where: {
    file: { isActive: true },
    grd: episodio.irGrdCodigo,
    gravedad: episodio.irGravedad
  }
});

// Calcular precio usando pesoTotal o pesoTotalDepu
const precio = normaMinsalData.pesoTotal * valorBase;
```

