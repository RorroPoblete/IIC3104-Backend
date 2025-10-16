# IIC3104 Backend - Monolito

Aplicación monolítica en Node.js + TypeScript que unifica los módulos de salud y codificación. Incluye PostgreSQL y Redis vía Docker y expone los endpoints del módulo de importación GRD y configuración pública para el frontend.

## Prerrequisitos

- Docker y Docker Compose
- (Opcional) Node.js 18+ si quieres ejecutar en modo desarrollo local

## Puesta en marcha con Docker

```bash
# Desde el directorio IIC3104-Backend
cp env.example .env            # Edita valores si es necesario
docker compose up --build -d              # Construye y levanta backend + postgres + redis
```

Servicios expuestos:

- Backend monolítico: http://localhost:3000
- PostgreSQL: localhost:5432 (DB: healthdb, user/pass: postgres)
- Redis: localhost:6379

Cuando termines:

```bash
docker compose down             # Detiene los contenedores
docker compose down -v --rmi local --remove-orphans           # (Opcional) Limpia volúmenes e imágenes
```

## Endpoints útiles

### Sistema
- `GET /health` comprueba estado del backend, PostgreSQL y Redis.
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

## Desarrollo local sin Docker

1. Instala dependencias: `npm install`
2. Genera Prisma: `npx prisma generate`
3. Ejecuta PostgreSQL y Redis localmente (o via `docker compose up postgres redis`)
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
- `src/modules/system`: health check y configuración pública.
- `src/shared`: clientes, logger y middlewares comunes.
