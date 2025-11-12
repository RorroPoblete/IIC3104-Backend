# IIC3104 Backend - Monolito

Aplicación monolítica en Node.js + TypeScript que unifica los módulos de salud y codificación. Incluye PostgreSQL vía Docker y expone los endpoints del módulo de importación GRD y configuración pública para el frontend.

## Prerrequisitos

- Docker y Docker Compose
- (Opcional) Node.js 18+ si quieres ejecutar en modo desarrollo local

## Puesta en marcha con Docker

```bash
# Desde el directorio IIC3104-Backend
cp env.example .env            # Edita valores si es necesario
docker compose up --build -d              # Construye y levanta backend + postgres
```

Servicios expuestos:

- Backend monolítico: http://localhost:3000
- PostgreSQL: localhost:5432 (DB: healthdb, user/pass: postgres)

Cuando termines:

```bash
docker compose down             # Detiene los contenedores
docker compose down -v --rmi local --remove-orphans           # (Opcional) Limpia volúmenes e imágenes
```

## Endpoints útiles

### Sistema
- `GET /health` comprueba estado del backend y PostgreSQL.
- `GET /public/config` entrega configuración pública (Auth0) para el frontend.

### Codificación
- `POST /api/codification/import/csv` importa archivos CSV (campo `file` en multipart/form-data).
- `GET /api/codification/import/batches` y derivados permiten consultar lotes, staging y datos normalizados.

### Norma Minsal
- `POST /api/normaminsal/import/csv` importa un archivo CSV de Norma Minsal (campo `file` en multipart/form-data, opcional `description`).
- `GET /api/normaminsal/import/batches` lista todos los lotes de Norma Minsal con paginación.
- `GET /api/normaminsal/import/batches/:id` obtiene detalles de un lote específico.
- `GET /api/normaminsal/import/batches/:id/data` obtiene los datos de un lote específico con paginación.
- `PATCH /api/normaminsal/import/batches/:id/activate` activa un lote para ser usado en las consultas.
- `GET /api/normaminsal/import/active-batch` obtiene el lote activo actual.
- `GET /api/normaminsal/import/query/grd/:grdCode` busca información de un GRD en el lote activo (query param opcional `gravedad`).
- `GET /api/normaminsal/import/query/grd/:grdCode/all` obtiene todas las variantes de gravedad de un GRD.
- `DELETE /api/normaminsal/import/batches/:id` elimina un lote y sus datos asociados.

### Tarifas GRD (Pricing)
- `POST /api/pricing/import` acepta archivos CSV/XLS/XLSX del anexo **Precios convenios GRD** y los carga en la base de datos (campo `file`, opcional `description`).
- `GET /api/pricing/import/files` lista los archivos cargados con paginación y cantidad de registros.
- `GET /api/pricing/import/files/:id` devuelve metadatos de un archivo específico.
- `GET /api/pricing/import/files/:id/data` devuelve todas las tarifas de un archivo con paginación.
- `PATCH /api/pricing/import/files/:id/activate` marca un archivo como activo para las reglas de pricing.
- `GET /api/pricing/import/active` retorna el archivo activo.
- `GET /api/pricing/prices/:convenioId` expone las tarifas del convenio (query opcional `tramo`, `fileId`). Estas tarifas alimentan el módulo `packages/rules/pricing`.
- `GET /api/pricing/calculate` calcula el precio base para un convenio y peso relativo dados (query params: `convenioId`, `pesoRelativo`, opcional `fechaReferencia`). Soporta convenios con precio único y por tramos (T1: 0–1.5, T2: 1.5<x≤2.5, T3: >2.5).

### Cálculo Integral de Episodios (V1)
- `POST /api/calculo/episodio/:id/run` ejecuta el cálculo integral de un episodio (V1). Body: `{ fechaReferencia?: string (ISO), usuario?: string }`. Calcula Precio Base × IR = Subtotal (Total Final en V1).
- `GET /api/calculo/episodio/:id/versiones` obtiene el historial de versiones de cálculo para un episodio.
- `GET /api/calculo/version/:id` obtiene el detalle completo de un cálculo específico (breakdown V1).

## Desarrollo local sin Docker

1. Instala dependencias: `npm install`
2. Genera Prisma: `npx prisma generate`
3. Ejecuta PostgreSQL localmente (o via `docker compose up postgres`)
4. Inicia el servidor: `npm run dev` (http://localhost:3000)

## Migraciones Prisma

### Producción (Render)

El contenedor ejecuta `npx prisma migrate deploy` al iniciar. Esto aplica migraciones versionadas en `prisma/migrations`.

### Desarrollo

Para crear y aplicar migraciones durante el desarrollo:

```bash
npx prisma migrate dev --name <cambio>
```

Para sincronizar sin crear migraciones (entornos efímeros):

```bash
npx prisma db push
```

## Estructura principal

- `src/config`: carga de variables de entorno.
- `src/modules/codification`: rutas y utilidades de importación CSV.
- `src/modules/normaminsal`: gestión de archivos de Norma Minsal.
- `src/modules/pricing`: importación y exposición de tarifas GRD, además de la integración con `packages/rules/pricing`.
- `src/modules/calculo`: cálculo integral de episodios GRD (V1) con versionado y auditoría.
- `src/modules/system`: health check y configuración pública.
- `src/shared`: clientes, logger y middlewares comunes.
