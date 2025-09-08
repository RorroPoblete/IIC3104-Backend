import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function run() {
  const email = 'admin@demo.cl';
  const exists = await prisma.user.findUnique({ where: { email } });
  if (!exists) {
    const passwordHash = await bcrypt.hash('Admin!123', 12);
    await prisma.user.create({ data: { email, passwordHash, role: Role.Admin, isActive: true } });
    console.log('Seeded admin user');
  } else {
    console.log('Admin user already exists');
  }
}

run()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

