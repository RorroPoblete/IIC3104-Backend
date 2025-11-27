#!/usr/bin/env sh

echo "Running database migrations..."
if npx prisma migrate deploy 2>/dev/null; then
  echo "Migrations applied successfully"
else
  echo "Migration deploy failed (database may need baseline), trying db push..."
  if npx prisma db push --skip-generate 2>/dev/null; then
    echo "Database schema synchronized"
  else
    echo "Warning: Could not sync database schema. Continuing anyway..."
  fi
fi

echo "Starting application..."
exec node dist/src/server.js
