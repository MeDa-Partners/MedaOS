import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { env } from '../src/config/env';

describe('Dev Admin & Security Isolation Tests', () => {
  let devSessionCookie: string;

  it('POST /api/v1/dev/auth/login with wrong credentials should return 401', async () => {
    const res = await request(app)
      .post('/api/v1/dev/auth/login')
      .send({ username: 'invalid_dev', password: 'WrongPassword!' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('Invalid developer credentials');
  });

  it('POST /api/v1/dev/auth/login with valid credentials should succeed and return cookie', async () => {
    const res = await request(app)
      .post('/api/v1/dev/auth/login')
      .send({
        username: env.DEV_ADMIN_USERNAME,
        password: env.DEV_ADMIN_PASSWORD,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isDeveloper).toBe(true);

    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies).toBeDefined();
    const devCookie = cookies.find((c: string) => c.startsWith(`${env.DEV_SESSION_COOKIE_NAME}=`));
    expect(devCookie).toBeDefined();
    devSessionCookie = devCookie!.split(';')[0];
  });

  it('GET /api/v1/dev/registry without dev cookie should return 401 Unauthorized', async () => {
    const res = await request(app).get('/api/v1/dev/registry');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/v1/dev/registry with dev cookie should return feature registry', async () => {
    const res = await request(app)
      .get('/api/v1/dev/registry')
      .set('Cookie', devSessionCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sections).toBeInstanceOf(Array);
    expect(res.body.data.ventures).toBeInstanceOf(Array);

    const salesSection = res.body.data.sections.find((s: any) => s.key === 'sales');
    expect(salesSection).toBeDefined();
    expect(salesSection.status).toBe('implemented');
  });

  it('GET /api/v1/dev/overview with dev cookie should return complete catalog overview', async () => {
    const res = await request(app)
      .get('/api/v1/dev/overview')
      .set('Cookie', devSessionCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ventures).toBeInstanceOf(Array);
    expect(res.body.data.summary).toBeDefined();
  }, 15000);

  it('Regular admin API: POST /api/v1/ventures should reject with 403 Forbidden', async () => {
    // Attempting to call regular venture creation
    const res = await request(app)
      .post('/api/v1/ventures')
      .send({ name: 'Hacked Venture', slug: 'hacked-venture' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('restricted to Dev Admin (/dev)');
  });

  it('Regular admin API: POST /api/v1/departments should reject with 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/v1/departments')
      .send({ name: 'Hacked Dept', slug: 'hacked-dept' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('restricted to Dev Admin (/dev)');
  });

  it('Regular admin API: POST /api/v1/sections should reject with 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/v1/sections')
      .send({ name: 'Hacked Section', slug: 'sales' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('restricted to Dev Admin (/dev)');
  });

  it('POST /api/v1/dev/auth/logout should clear dev session cookie', async () => {
    const res = await request(app)
      .post('/api/v1/dev/auth/logout')
      .set('Cookie', devSessionCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies).toBeDefined();
    const cleared = cookies.find((c: string) => c.startsWith(`${env.DEV_SESSION_COOKIE_NAME}=;`));
    expect(cleared).toBeDefined();
  });
});
