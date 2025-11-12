# Solución: Error 500 en Cálculo de Episodios

## 🔴 Problema

Error 500 (Internal Server Error) al intentar:
- `GET /api/calculo/episodio/:id/versiones`
- `POST /api/calculo/episodio/:id/run`

## 🔍 Causa

Las tablas de cálculo (`calculo_episodios` y `calculo_auditoria`) no existían en la base de datos porque no se habían ejecutado las migraciones de Prisma.

## ✅ Solución Aplicada

1. **Se creó la migración:**
   ```bash
   npx prisma migrate dev --name add_calculo_episodio_and_auditoria
   ```

2. **Se aplicó la migración:**
   ```bash
   npx prisma migrate deploy
   ```

3. **Se mejoró el manejo de errores** para detectar este problema y dar mensajes más claros.

## 🐳 Si usas Docker

Si estás usando Docker Compose, las migraciones deberían aplicarse automáticamente al iniciar el contenedor. Si no:

### Opción 1: Reiniciar el contenedor
```bash
cd IIC3104-Backend
docker compose restart backend
```

### Opción 2: Ejecutar migración dentro del contenedor
```bash
docker compose exec backend npx prisma migrate deploy
```

### Opción 3: Reconstruir el contenedor
```bash
docker compose down
docker compose up --build -d
```

## 🔧 Verificación

Para verificar que las tablas existen:

```sql
-- Conectarse a PostgreSQL
psql -h localhost -U postgres -d healthdb

-- Verificar tablas
\dt calculo_*

-- Deberías ver:
-- calculo_episodios
-- calculo_auditoria
```

O desde Prisma Studio:
```bash
npx prisma studio
```

## 📝 Próximos Pasos

1. **Reinicia el backend** (si usas Docker)
2. **Prueba nuevamente** el cálculo desde el frontend
3. **Revisa los logs** si aún hay errores:
   ```bash
   docker compose logs backend | grep CalculoService
   ```

## 🎯 Mensajes de Error Mejorados

Ahora el sistema detecta si las tablas no existen y muestra un mensaje claro:

```json
{
  "success": false,
  "message": "Las tablas de cálculo no existen. Ejecuta las migraciones de Prisma: npx prisma migrate deploy",
  "error": "DATABASE_SCHEMA_ERROR"
}
```

## ✅ Checklist

- [x] Migración creada
- [x] Migración aplicada
- [x] Manejo de errores mejorado
- [ ] Backend reiniciado (si usas Docker)
- [ ] Prueba exitosa desde frontend

