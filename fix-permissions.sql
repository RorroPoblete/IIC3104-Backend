-- Script para corregir permisos de PostgreSQL
-- Ejecutar como superusuario

-- Otorgar permisos por defecto para nuevas tablas y secuencias
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;

-- Otorgar permisos en tablas y secuencias existentes
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- Permitir uso del schema public
GRANT USAGE ON SCHEMA public TO postgres;

-- Permitir crear objetos en el schema
GRANT CREATE ON SCHEMA public TO postgres;

-- Si necesitas permisos en la base de datos también
GRANT ALL PRIVILEGES ON DATABASE healthdb TO postgres;

-- Verificar permisos
\dp public.*

