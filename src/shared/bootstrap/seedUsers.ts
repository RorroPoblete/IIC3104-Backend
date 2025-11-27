import { prisma } from '../db/prisma';
import { logger } from '../utils/logger';

const defaultUsers = [
  {
    name: 'Javiera Necochea',
    email: 'jnecochea1@uc.cl',
    role: 'Administrador',
  },
  {
    name: 'Felipe Guzmán',
    email: 'fguzmancovarrubias@gmail.com',
    role: 'Administrador',
  },
];

export const ensureDefaultUsers = async () => {
  for (const user of defaultUsers) {
    const normalizedEmail = user.email.toLowerCase();

    const exists = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (exists) {
      continue;
    }

    await prisma.user.create({
      data: {
        name: user.name,
        email: normalizedEmail,
        role: user.role,
      },
    });

    logger.info(`Usuario base creado: ${user.email}`);
  }
};
