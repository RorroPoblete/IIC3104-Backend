import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addUser() {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.error('Uso: ts-node scripts/add-user.ts <nombre> <email> <rol>');
    console.error('Roles disponibles: Administrador, Analista, Codificador, Finanzas');
    process.exit(1);
  }

  const [name, email, role] = args;
  const normalizedEmail = email.toLowerCase().trim();

  try {
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      console.log(`❌ Ya existe un usuario con el email: ${normalizedEmail}`);
      process.exit(1);
    }

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: normalizedEmail,
        role: role.trim(),
      },
    });

    console.log(`✅ Usuario creado exitosamente:`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Nombre: ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Rol: ${user.role}`);
  } catch (error) {
    console.error('❌ Error creando usuario:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

addUser();

