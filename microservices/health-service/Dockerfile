FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
# Instala TODAS las dependencias (incluye dev) para poder compilar TypeScript
RUN npm install

COPY src ./src
RUN npm run build

# Elimina dependencias de desarrollo para la imagen final
RUN npm prune --omit=dev

EXPOSE 3000
CMD ["npm", "start"]
