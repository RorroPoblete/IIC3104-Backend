# Backend - Sistema GRD-FONASA

Backend del sistema de gestión hospitalaria con microservicios.

## Instalación

```bash
cp env.example .env
```

## Ejecutar

```bash
docker compose up --build
```

Servicios disponibles:

- Auth Service: `http://localhost:3001`
- Health Service: `http://localhost:3000`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

## Autenticación (Auth0)

- Configurar `.env` en la raíz de `IIC3104-Backend`:

```
AUTH_SERVICE_PORT=3001
CORS_ORIGIN=http://localhost:8000
AUTH0_DOMAIN=tu-dominio.auth0.com
AUTH0_AUDIENCE=https://uc-grd-api
AUTH0_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxx
```

- El frontend obtiene la configuración desde `GET http://localhost:3001/public/config`.
- Endpoints protegidos usan JWT RS256 de Auth0 (validación con JWKS).

## Documentación

- Auth Service Swagger: `http://localhost:3001/docs`
- Health check (health-service): `http://localhost:3000/health`
- Config pública: `http://localhost:3001/public/config`
- Rutas protegidas:
  - `GET http://localhost:3001/api/admin/ping`
  - `GET http://localhost:3001/api/me`

## Estructura

- `microservices/auth-service/` - Servicio de autenticación
- `microservices/health-service/` - Servicio de salud
- `docker-compose.yml` - Configuración de servicios
