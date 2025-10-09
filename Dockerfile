FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma
COPY tsconfig.json ./

RUN npm ci

COPY src ./src
COPY docker/entrypoint.sh ./docker/entrypoint.sh

RUN npm run build \
  && npm run prisma:generate \
  && npm prune --production \
  && chmod +x docker/entrypoint.sh \
  && mkdir -p logs uploads

ENV NODE_ENV=production \
    PORT=3000

EXPOSE 3000

ENTRYPOINT ["/app/docker/entrypoint.sh"]
