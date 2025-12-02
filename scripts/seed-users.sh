#!/bin/sh

echo "🌱 Ejecutando seed de usuarios..."

# En Docker, el código está compilado en dist/
if [ -d "dist" ]; then
  node -e "
    const { ensureDefaultUsers } = require('./dist/src/shared/bootstrap/seedUsers');
    ensureDefaultUsers()
      .then(() => {
        console.log('✅ Seed completado exitosamente');
        process.exit(0);
      })
      .catch((error) => {
        console.error('❌ Error ejecutando seed:', error);
        process.exit(1);
      });
  "
else
  # En desarrollo, usar ts-node
  npx ts-node scripts/seed-users.ts
fi


