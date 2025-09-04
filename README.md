# IIC3104 Backend - Health Service

Guía básica para clonar y ejecutar un microservicio mínimo con Node.js + TypeScript. Expone un endpoint `/health` y documentación Swagger en `/docs`. Incluye PostgreSQL y Redis con Docker.

## 1) Clonar el repositorio
```bash
git clone <URL_DEL_REPO>
cd IIC3104-Backend
```

## 2) Configurar variables de entorno
```bash
cp env.example .env
```
Puedes usar los valores por defecto.

## 3) Ejecutar con Docker (recomendado)
```bash
docker compose up --build
```
Esto levanta:
- Health Service en `http://localhost:3000`
- PostgreSQL en `localhost:5432` (DB: healthdb, user: postgres, pass: postgres)
- Redis en `localhost:6379`

## 4) Probar
- Swagger UI: `http://localhost:3000/docs`
- Health: `http://localhost:3000/health`

Deberías ver una respuesta como:
```json
{
  "message": "Hello World",
  "postgresNow": "2025-01-01T00:00:00.000Z",
  "redisPing": "pong"
}
```

## (Opcional) Ejecutar en desarrollo sin Docker
Requiere Node.js 18+ instalado.
```bash
# Instalar dependencias del servicio
npm --prefix microservices/health-service install

# Ejecutar en modo dev (hot reload)
npm --prefix microservices/health-service run dev
```
El servicio quedará en `http://localhost:3000`.

---
Si algo falla, reinicia con:
```bash
docker compose down && docker compose up --build
```