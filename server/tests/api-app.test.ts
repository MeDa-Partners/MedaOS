import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';

describe('Express API Integration Tests', () => {
  it('GET /health should return 200 healthy status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('healthy');
    expect(res.body.data.service).toBe('meda-os-backend');
  });

  it('GET /non-existent-route should return 404 NotFoundError', async () => {
    const res = await request(app).get('/api/v1/unknown-endpoint');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('not found');
  });

  it('POST /api/v1/auth/login with invalid payload should return 400 validation error', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email', password: '' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toBe('Validation failed');
  });

  it('GET /api/v1/auth/me without session cookie should return 401 Unauthorized', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toBe('Authentication required');
  });

  it('GET /api/v1/users without session cookie should return 401 Unauthorized', async () => {
    const res = await request(app).get('/api/v1/users');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toBe('Authentication required');
  });

  it('GET /api/v1/sections/sales/access-check without session cookie should return 401 Unauthorized', async () => {
    const res = await request(app).get('/api/v1/sections/sales/access-check');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toBe('Authentication required');
  });

  it.each(['/api/v1/orders?ventureId=wayveda', '/api/v1/orders/00000000-0000-0000-0000-000000000000?ventureId=wayveda', '/api/v1/sync/health?ventureId=wayveda', '/api/v1/shifts?ventureId=wayveda'])(
    'GET %s without session cookie should return 401 Unauthorized',
    async (path) => {
      const res = await request(app).get(path);
      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Authentication required');
    }
  );
});

describe('order work routes require a session', () => {
  const id = '00000000-0000-0000-0000-000000000000';
  it.each([
    ['patch', `/api/v1/orders/${id}/verification?ventureId=wayveda`],
    ['patch', `/api/v1/orders/${id}/portal?ventureId=wayveda`],
    ['patch', `/api/v1/orders/${id}/follow-up?ventureId=wayveda`],
    ['post', `/api/v1/orders/${id}/reassign?ventureId=wayveda`],
    ['post', '/api/v1/orders/bulk-reassign?ventureId=wayveda'],
    ['put', '/api/v1/shifts?ventureId=wayveda'],
  ] as const)('%s %s → 401', async (method, path) => {
    const res = await request(app)[method](path).send({});
    expect(res.status).toBe(401);
  });
});
