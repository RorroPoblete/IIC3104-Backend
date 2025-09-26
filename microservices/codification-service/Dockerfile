FROM node:18-alpine

# Instalar dependencias del sistema necesarias para Prisma
RUN apk add --no-cache openssl

# Crear directorio de trabajo
WORKDIR /app

# Copiar archivos de configuración
COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/

# Instalar todas las dependencias (incluyendo dev para compilar)
RUN npm install

# Copiar código fuente
COPY src/ ./src/

# Compilar TypeScript
RUN npm run build

# Generar cliente de Prisma
RUN npx prisma generate

# Limpiar dependencias de desarrollo
RUN npm prune --omit=dev

# Crear directorio para logs
RUN mkdir -p logs

# Exponer puerto
EXPOSE 3004

# Comando para ejecutar la aplicación
CMD ["npm", "start"]
