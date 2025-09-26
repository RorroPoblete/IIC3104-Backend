# Backend - Sistema GRD-FONASA

Backend del sistema de gestión hospitalaria con microservicios.

## Instalación rápida (desarrollo)

1. Copia las variables de ejemplo y revisa los valores por defecto:

   ```bash
   cp env.example .env
   ```

2. Completa **todas** las variables de `.env`; ningún servicio usa valores por defecto, por lo que fallarán al iniciar si falta uno solo. El backend expone los valores de Auth0 vía `/public/config` al frontend.

3. Si deseas ejecutar sin Docker, instala dependencias en cada microservicio y arranca con `npm start`. Asegúrate de que PostgreSQL y Redis estén disponibles con las URLs declaradas en `.env`.

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

- Configurar `.env` en la raíz de `IIC3104-Backend`. El backend no arranca si faltan `AUTH_SERVICE_PORT`, `CORS_ORIGIN`, `DATABASE_URL`, `REDIS_URL`, `AUTH0_DOMAIN`, `AUTH0_AUDIENCE` o `AUTH0_CLIENT_ID`.
- Los placeholders `YOUR_*` en `env.example` deben reemplazarse por credenciales reales antes de ejecutar (el backend falla si detecta un placeholder sin reemplazar). Asimismo, cambia `JWT_SECRET` y apunta `DATABASE_URL`/`REDIS_URL` al entorno correspondiente.

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
