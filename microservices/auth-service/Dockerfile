FROM node:20-bookworm-slim AS base
WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
# No hay package-lock.json en el repo, usar npm install
RUN npm install
RUN npx prisma generate

COPY src ./src
RUN npm run build

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
# Dependencias del sistema en runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/dist ./dist
COPY --from=base /app/prisma ./prisma
COPY package*.json ./
EXPOSE 3001
RUN npm prune --omit=dev
CMD ["node", "dist/index.js"]
