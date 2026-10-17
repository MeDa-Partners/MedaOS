// Temporary: seeds / removes a throwaway demo venture for browser testing. Deleted after use.
import { like, inArray } from 'drizzle-orm';
import { env } from '../src/config/env';
import { db, sqlClient } from '../src/db';
import { users, ventures } from '../src/db/schema';

const API = 'http://localhost:5055/api/v1';
const PASSWORD = 'DemoPass1!';

class C {
  cookie = '';
  async ok(method: string, path: string, body?: unknown) {
    const res = await fetch(API + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(this.cookie && { Cookie: this.cookie }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const sc = res.headers.get('set-cookie');
    if (sc) this.cookie = sc.split(';')[0];
    const j: any = await res.json();
    if (!res.ok) throw new Error(`${method} ${path} ${res.status} ${j?.error?.message}`);
    return j.data;
  }
}

async function cleanup() {
  const vs = await db.select({ id: ventures.id }).from(ventures).where(like(ventures.slug, 'zz-demo%'));
  if (vs.length) await db.delete(ventures).where(inArray(ventures.id, vs.map((v) => v.id)));
  const us = await db.select({ id: users.id }).from(users).where(like(users.email, '%@demo.meda.test'));
  if (us.length) await db.delete(users).where(inArray(users.id, us.map((u) => u.id)));
  console.log(`removed ${vs.length} ventures, ${us.length} users`);
}

async function seed() {
  await cleanup();
  const dev = new C();
  await dev.ok('POST', '/dev/auth/login', { username: env.DEV_ADMIN_USERNAME, password: env.DEV_ADMIN_PASSWORD });
  const v = await dev.ok('POST', '/dev/ventures', { name: 'ZZ Demo Venture', slug: 'zz-demo' });
  const sales = await dev.ok('POST', '/dev/departments', { ventureId: v.id, name: 'Sales', slug: 'sales' });
  const ops = await dev.ok('POST', '/dev/departments', { ventureId: v.id, name: 'Operations', slug: 'operations' });
  const leads = await dev.ok('POST', '/dev/sections', { departmentId: sales.id, name: 'Leads', slug: 'leads' });
  const deals = await dev.ok('POST', '/dev/sections', { departmentId: sales.id, name: 'Deals', slug: 'deals' });
  await dev.ok('POST', '/dev/sections', { departmentId: sales.id, name: 'Payouts', slug: 'payouts' });
  await dev.ok('POST', '/dev/sections', { departmentId: ops.id, name: 'Stock', slug: 'stock' });

  const admin = new C();
  await admin.ok('POST', '/auth/login', { email: env.ADMIN_INITIAL_EMAIL, password: env.ADMIN_INITIAL_PASSWORD });
  const mk = (name: string, local: string, departmentId: string, teamId: string | null = null, sectionIds: string[] = []) =>
    admin.ok('POST', '/users', { name, email: `${local}@demo.meda.test`, password: PASSWORD, departmentId, teamId, sectionIds });

  const dh = await mk('Priya Sharma', 'priya', sales.id);
  await admin.ok('PATCH', `/departments/${sales.id}/head`, { headUserId: dh.id });
  const north = await admin.ok('POST', '/teams', { departmentId: sales.id, name: 'North' });
  const south = await admin.ok('POST', '/teams', { departmentId: sales.id, name: 'South' });
  const th = await mk('Rahul Mehta', 'rahul', sales.id, north.id, [leads.id, deals.id]);
  await admin.ok('PATCH', `/teams/${north.id}/head`, { headUserId: th.id });
  await mk('Alice Fernandes', 'alice', sales.id, north.id, [deals.id]);
  await mk('Bob Singh', 'bob', sales.id, south.id);
  await mk('Carol Dsouza', 'carol', sales.id, null);
  await mk('Dev Kapoor', 'devk', ops.id, null);
  console.log('seeded. password for all:', PASSWORD);
}

(process.argv[2] === 'cleanup' ? cleanup() : seed())
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => sqlClient.end());
