import request from 'supertest';
import app from '../src/index';
import { prisma } from '../src/utils/prisma';
import bcrypt from 'bcrypt';

describe('Auth login and admin ping', () => {
  beforeAll(async () => {
    // ensure test admin exists
    const email = 'admin@demo.cl';
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      const passwordHash = await bcrypt.hash('Admin!123', 10);
      await prisma.user.create({ data: { email, passwordHash, role: 'Admin', isActive: true } });
    }
  });

  it('rejects invalid input', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'bad', password: 'short' });
    expect(res.status).toBe(400);
  });

  it('rejects wrong credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@demo.cl', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('accepts correct login and allows admin ping', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@demo.cl', password: 'Admin!123' });
    expect(res.status).toBe(200);
    const token = res.body.accessToken;
    const ping = await request(app).get('/api/admin/ping').set('Authorization', `Bearer ${token}`);
    expect(ping.status).toBe(200);
  });
});

