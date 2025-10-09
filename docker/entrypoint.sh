#!/usr/bin/env sh
set -e

echo "Running database migrations..."
npx prisma db push

echo "Starting application..."
exec node dist/server.js
