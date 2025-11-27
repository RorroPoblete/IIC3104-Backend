import { PrismaClient } from '@prisma/client';

// Importar desde src (desarrollo) o dist (producción)
let ensureDefaultUsers: () => Promise<void>;
try {
  // Intentar importar desde src (desarrollo con ts-node)
  ensureDefaultUsers = require('../src/shared/bootstrap/seedUsers').ensureDefaultUsers;
} catch {
  // Si falla, intentar desde dist (producción compilada)
  ensureDefaultUsers = require('../dist/src/shared/bootstrap/seedUsers').ensureDefaultUsers;
}

const prisma = new PrismaClient();

async function seed() {
  try {
    console.log('🌱 Ejecutando seed de usuarios...');
    await ensureDefaultUsers();
    console.log('✅ Seed completado exitosamente');
  } catch (error) {
    console.error('❌ Error ejecutando seed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seed();

