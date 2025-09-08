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

## Login

```bash
POST http://localhost:3001/api/auth/login
{
  "email": "admin@demo.cl",
  "password": "Admin!123"
}
```

## Documentación

- Swagger: `http://localhost:3000/docs`
- Health check: `http://localhost:3000/health`

## Estructura

- `microservices/auth-service/` - Servicio de autenticación
- `microservices/health-service/` - Servicio de salud
- `docker-compose.yml` - Configuración de servicios
