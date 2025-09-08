import 'dotenv/config';
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@demo.cl';
  const password = 'Admin!123';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.create({
      data: { email, passwordHash, role: Role.Admin, isActive: true },
    });
    console.log('Seeded admin user');
  } else {
    console.log('Admin user already exists');
  }
}

main().finally(async () => prisma.$disconnect());

