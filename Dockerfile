FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma
COPY tsconfig.json ./

RUN npm ci

COPY src ./src
COPY packages ./packages
COPY docker/entrypoint.sh ./docker/entrypoint.sh

# Generar Prisma Client antes de compilar TypeScript para evitar errores en build
RUN npm run prisma:generate \
  && npm run build \
  && npm prune --production \
  && chmod +x docker/entrypoint.sh \
  && mkdir -p logs uploads

ENV NODE_ENV=production \
    PORT=3000

EXPOSE 3000

ENTRYPOINT ["/app/docker/entrypoint.sh"]
