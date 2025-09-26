# Servicio de Codificación

Microservicio para procesar archivos CSV con datos de episodios médicos y codificación GRD-FONASA.

## Características

- Procesamiento de archivos CSV con separador `;` y codificación `latin-1`
- Validación de estructura de 80 columnas específicas
- Almacenamiento en staging y modelo normalizado
- Control de lotes de importación
- API REST para gestión de importaciones

## Estructura de Base de Datos

### Tablas Principales

1. **ImportBatch**: Control de lotes de importación
2. **ImportStagingRow**: Almacenamiento raw de filas CSV
3. **NormalizedData**: Datos normalizados y tipados

### Columnas del CSV (80 columnas)

El servicio espera un CSV con exactamente estas 80 columnas en este orden:

1. Episodio CMBD
2. Edad en años
3. Sexo (Desc)
4. Conjunto Dx
5. Tipo Actividad
6. Tipo Ingreso (Descripción)
7. Servicio Ingreso (Descripción)
8. Servicio Ingreso (Código)
9. Motivo Egreso (Descripción)
10. Medico Egreso (Descripción)
11. Especialidad Servicio Egreso (Descripción)
12. Servicio Egreso (Código)
13. Servicio Egreso (Descripción)
14. Prevision (Cód)
15. Prevision (Desc)
16. Prevision 2 ( Cod )
17. Prevision 2 ( Desc )
18. Ley ( Cod )
19. Ley ( Desc )
20. Convenios (cod)
21. Convenios (des)
22. Servicio Salud (cod)
23. Servicio Salud (des)
24. Estancias Prequirurgicas Int -Episodio-
25. Estancias Postquirurgicas Int -Episodio-
26. EM PRE-Quirúrgica
27. EM POST-Quirúrgica
28. Estancia del Episodio
29. Estancia real del episodio
30. Horas de Estancia
31. Estancia Media
32. Peso GRD Medio (Todos)
33. Peso Medio [Norma IR]
34. IEMA IR Bruto
35. EMAf IR Bruta
36. Impacto (Estancias evitables) Brutas
37. IR Gravedad (desc)
38. IR Mortalidad (desc)
39. IR Tipo GRD
40. IR GRD (Código)
41. IR GRD
42. IR Punto Corte Inferior
43. IR Punto Corte Superior
44. EM [Norma IR]
45. Estancias [Norma IR]
46. Casos [Norma IR]
47. Fecha Ingreso completa
48. Fecha Completa
49. Conjunto de Servicios Traslado
50. Fecha (tr1)
51. Fecha (tr2)
52. Fecha (tr3)
53. Fecha (tr4)
54. Fecha (tr5)
55. Fecha (tr6)
56. Fecha (tr7)
57. Fecha (tr8)
58. Fecha (tr9)
59. Fecha (tr10)
60. E.M. Traslados Servicio
61. Facturación Total del episodio
62. Especialidad médica de la intervención (des)
63. IR Alta Inlier / Outlier
64. Año
65. Mes (Número)
66. Diagnóstico Principal
67. Proced 01 Principal (cod)
68. Conjunto Procedimientos Secundarios
69. Servicio Ingreso (Código)_1
70. Servicio(cod) (tr1)
71. Servicio(cod) (tr2)
72. Servicio(cod) (tr3)
73. Servicio(cod) (tr4)
74. Servicio(cod) (tr5)
75. Servicio(cod) (tr6)
76. Servicio(cod) (tr7)
77. Servicio(cod) (tr8)
78. Servicio(cod) (tr9)
79. Servicio(cod) (tr10)
80. Servicio Egreso (Código)_2

## API Endpoints

### Importación

- `POST /import/csv` - Importar archivo CSV
- `GET /import/batches` - Listar lotes de importación
- `GET /import/batches/:id` - Obtener detalles de un lote
- `GET /import/batches/:id/staging` - Obtener filas de staging
- `GET /import/batches/:id/normalized` - Obtener datos normalizados

### Health Check

- `GET /health` - Estado del servicio

## Configuración

### Variables de Entorno

```env
CODIFICATION_SERVICE_PORT=3004
DATABASE_URL=postgres://postgres:postgres@localhost:5432/healthdb
CORS_ORIGIN=http://localhost:5173
UPLOAD_PATH=/tmp/uploads
MAX_FILE_SIZE=10485760
```

`CORS_ORIGIN` admite una lista separada por comas cuando necesitas habilitar más de un origen.

### Docker

```bash
# Construir imagen
docker build -t codification-service .

# Ejecutar con docker-compose
docker-compose up codification-service
```

## Desarrollo

```bash
# Instalar dependencias
npm install

# Generar cliente Prisma
npm run db:generate

# Ejecutar migraciones
npm run db:migrate

# Desarrollo
npm run dev

# Seed de datos
npm run db:seed
```

## Uso

### Importar archivo CSV

```bash
curl -X POST http://localhost:3004/import/csv \
  -F "file=@datos.csv" \
  -H "Content-Type: multipart/form-data"
```

### Respuesta de importación

```json
{
  "success": true,
  "message": "Importación completada",
  "data": {
    "batchId": "clx123...",
    "totalRows": 1000,
    "processedRows": 995,
    "errorRows": 5,
    "status": "PARTIALLY_COMPLETED",
    "parseErrors": []
  }
}
```

## Estados de Lote

- `PENDING`: Lote creado, pendiente de procesamiento
- `PROCESSING`: En proceso de importación
- `COMPLETED`: Completado exitosamente
- `FAILED`: Falló completamente
- `PARTIALLY_COMPLETED`: Completado con errores

## Logs

Los logs se almacenan en:
- `logs/combined.log` - Todos los logs
- `logs/error.log` - Solo errores
- Consola con formato coloreado en desarrollo
