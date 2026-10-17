/**
 * End-to-end check of the access model against a running API + real database.
 *
 *   PORT=5055 npm run dev            (in one terminal)
 *   E2E_API=http://localhost:5055/api/v1 npm run test:e2e
 *
 * Creates a throwaway venture "zz-e2e-<timestamp>" with test users (emails @e2e.meda.test)
 * and removes all of it at the end, even when a check fails.
 */
import { inArray, like } from 'drizzle-orm';
import { env } from '../src/config/env';
import { db, sqlClient } from '../src/db';
import { users } from '../src/db/schema';

const API = process.env.E2E_API || `http://localhost:${env.PORT}/api/v1`;
const RUN = Date.now().toString(36);
const PASSWORD = 'E2e-Passw0rd!';
const email = (name: string) => `${name}-${RUN}@e2e.meda.test`;

let failures = 0;
function check(label: string, ok: boolean, detail?: unknown) {
  if (ok) console.log(`  ✓ ${label}`);
  else {
    failures++;
    console.log(`  ✗ ${label}`, detail ?? '');
  }
}

class Client {
  cookie = '';
  async call(method: string, path: string, body?: unknown) {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(this.cookie && { Cookie: this.cookie }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) this.cookie = setCookie.split(';')[0];
    const json = (await res.json().catch(() => ({}))) as { data?: any; error?: { message: string } };
    return { status: res.status, data: json.data, error: json.error?.message };
  }
  async ok(method: string, path: string, body?: unknown) {
    const r = await this.call(method, path, body);
    if (r.status >= 300) throw new Error(`${method} ${path} → ${r.status} ${r.error}`);
    return r.data;
  }
}

async function login(emailAddr: string, password = PASSWORD) {
  const c = new Client();
  await c.ok('POST', '/auth/login', { email: emailAddr, password });
  return c;
}

const sectionIdsOf = (user: any, departmentId: string): string[] =>
  (user.ventures.find((v: any) => v.departmentId === departmentId)?.sections ?? []).map((s: any) => s.id).sort();

async function main() {
  const dev = new Client();
  let ventureId: string | undefined;

  try {
    console.log(`API ${API}\n\n1. Catalog (dev admin)`);
    await dev.ok('POST', '/dev/auth/login', { username: env.DEV_ADMIN_USERNAME, password: env.DEV_ADMIN_PASSWORD });
    const venture = await dev.ok('POST', '/dev/ventures', { name: `ZZ E2E ${RUN}`, slug: `zz-e2e-${RUN}` });
    ventureId = venture.id;
    const sales = await dev.ok('POST', '/dev/departments', { ventureId, name: 'Sales', slug: 'sales' });
    const ops = await dev.ok('POST', '/dev/departments', { ventureId, name: 'Ops', slug: 'ops' });
    const s1 = await dev.ok('POST', '/dev/sections', { departmentId: sales.id, name: 'Leads', slug: 'leads' });
    const s2 = await dev.ok('POST', '/dev/sections', { departmentId: sales.id, name: 'Deals', slug: 'deals' });
    const s3 = await dev.ok('POST', '/dev/sections', { departmentId: sales.id, name: 'Payouts', slug: 'payouts' });
    const o1 = await dev.ok('POST', '/dev/sections', { departmentId: ops.id, name: 'Stock', slug: 'stock' });
    const dup = await dev.call('POST', '/dev/sections', { departmentId: ops.id, name: 'Leads', slug: 'leads' });
    check('section slug must be unique across the venture (URL /venture/section)', dup.status === 409, dup);
    const reserved = await dev.call('POST', '/dev/ventures', { name: 'Teams', slug: 'teams' });
    check('venture slug cannot shadow app pages', reserved.status === 400, reserved);

    console.log('\n2. Admin creates the department head');
    const admin = await login(env.ADMIN_INITIAL_EMAIL, env.ADMIN_INITIAL_PASSWORD);
    const dh = await admin.ok('POST', '/users', {
      name: 'Dept Head', email: email('dh'), password: PASSWORD, departmentId: sales.id,
    });
    await admin.ok('PATCH', `/departments/${sales.id}/head`, { headUserId: dh.id });
    const adminCreateDept = await admin.call('POST', '/departments', { ventureId, name: 'X' });
    check('admin cannot create departments outside /dev', adminCreateDept.status === 404, adminCreateDept.status);

    console.log('\n3. Department head builds the department');
    const dhc = await login(email('dh'));
    const north = await dhc.ok('POST', '/teams', { departmentId: sales.id, name: 'North' });
    const south = await dhc.ok('POST', '/teams', { departmentId: sales.id, name: 'South' });
    const opsTeam = await dhc.call('POST', '/teams', { departmentId: ops.id, name: 'Nope' });
    check('department head cannot create teams in another department', opsTeam.status === 403, opsTeam);

    const mk = (name: string, teamId: string | null) =>
      dhc.ok('POST', '/users', { name, email: email(name), password: PASSWORD, departmentId: sales.id, teamId });
    const th = await mk('th', north.id);
    const a = await mk('alice', north.id);
    const b = await mk('bob', south.id);
    const c = await mk('carol', null);
    check('employee can be created with no team', c.ventures[0]?.teamId === null, c.ventures[0]);
    const outside = await dhc.call('POST', '/users', {
      name: 'x', email: email('x'), password: PASSWORD, departmentId: ops.id,
    });
    check('department head cannot create employees in another department', outside.status === 403, outside);

    await dhc.ok('PATCH', `/teams/${north.id}/head`, { headUserId: th.id });
    await dhc.ok('PUT', `/users/${th.id}/sections`, { departmentId: sales.id, sectionIds: [s1.id, s2.id] });
    check('department head granted team head Leads + Deals', true);

    console.log('\n4. Team head');
    const thc = await login(email('th'));
    const seen = await thc.ok('GET', `/users?ventureId=${ventureId}`);
    const seenIds = seen.users.map((u: any) => u.id);
    check('team head sees their team only', seenIds.includes(a.id) && !seenIds.includes(b.id) && !seenIds.includes(c.id), seenIds);

    check('team head can grant a section they hold', (await thc.call('POST', `/users/${a.id}/sections/${s1.id}`)).status === 200);
    const notHeld = await thc.call('POST', `/users/${a.id}/sections/${s3.id}`);
    check('team head cannot grant a section they do not hold', notHeld.status === 403, notHeld);
    const otherTeam = await thc.call('POST', `/users/${b.id}/sections/${s1.id}`);
    check('team head cannot grant to someone outside their team', otherTeam.status === 403, otherTeam);
    const moveTeam = await thc.call('PUT', `/users/${a.id}/membership`, { departmentId: sales.id, teamId: south.id });
    check('team head cannot change anyone’s team', moveTeam.status === 403, moveTeam);
    const thCreate = await thc.call('POST', '/users', { name: 'y', email: email('y'), password: PASSWORD, departmentId: sales.id });
    check('team head cannot create employees', thCreate.status === 403, thCreate);
    const thSelf = await thc.call('POST', `/users/${th.id}/sections/${s3.id}`);
    check('team head cannot grant themselves more access', thSelf.status === 403, thSelf);

    await dhc.ok('POST', `/users/${a.id}/sections/${s3.id}`);
    const afterTh = await thc.ok('PUT', `/users/${a.id}/sections`, { departmentId: sales.id, sectionIds: [s2.id] });
    check(
      'team head’s bulk update keeps sections they don’t hold (Payouts) and swaps Leads → Deals',
      JSON.stringify(sectionIdsOf(afterTh, sales.id)) === JSON.stringify([s2.id, s3.id].sort()),
      sectionIdsOf(afterTh, sales.id)
    );
    const thUi = afterTh.ventures[0].capabilities;
    check('UI capabilities tell the team head which sections they can grant',
      thUi.canManageSections && !thUi.canChangeTeam && thUi.grantableSectionIds.length === 2, thUi);

    console.log('\n5. Employee opens sections');
    const ac = await login(email('alice'));
    const me = await ac.ok('GET', '/auth/me');
    const mine = me.ventures.find((v: any) => v.venture.id === ventureId);
    check('employee /me lists exactly their granted sections', mine?.sections.map((s: any) => s.slug).sort().join() === 'deals,payouts', mine?.sections);
    check('employee role is member', mine?.role === 'member', mine?.role);
    const allowed = await ac.ok('GET', `/sections/deals/access-check?ventureId=zz-e2e-${RUN}`);
    const denied = await ac.ok('GET', `/sections/leads/access-check?ventureId=zz-e2e-${RUN}`);
    check('access-check allows granted section', allowed.allowed === true, allowed);
    check('access-check denies ungranted section', denied.allowed === false, denied);
    const peopleAsMember = await ac.call('GET', '/users');
    check('plain employees cannot open people management', peopleAsMember.status === 403, peopleAsMember.status);
    const dhMe = await dhc.ok('GET', '/auth/me');
    check('department head sees every department section', dhMe.ventures.find((v: any) => v.venture.id === ventureId)?.sections.length === 3);

    console.log('\n6. Department head placement + account management');
    const placed = await dhc.ok('PUT', `/users/${c.id}/membership`, { departmentId: sales.id, teamId: north.id });
    check('department head assigns a team', placed.ventures[0].teamId === north.id);
    const steal = await dhc.call('PUT', `/users/${c.id}/membership`, { departmentId: ops.id, teamId: null });
    check('department head cannot move people to another department', steal.status === 403, steal);
    await dhc.ok('DELETE', `/teams/${south.id}`);
    const bAfter = await dhc.ok('GET', `/users/${b.id}`);
    check('deleting a team keeps its members in the department', bAfter.ventures[0]?.teamId === null, bAfter.ventures[0]);
    check('department head can rename an employee', (await dhc.call('PATCH', `/users/${a.id}`, { name: 'Alice B' })).status === 200);
    check('team head cannot rename an employee', (await thc.call('PATCH', `/users/${a.id}`, { name: 'Nope' })).status === 403);

    console.log('\n7. Admin moves someone across departments');
    const moved = await admin.ok('PUT', `/users/${a.id}/membership`, { departmentId: ops.id, teamId: null });
    check('moving departments clears old section grants', moved.ventures[0].sections.length === 0, moved.ventures[0]);
    const opsGrant = await thc.call('POST', `/users/${a.id}/sections/${o1.id}`);
    check('former team head has no say once the person left their team', opsGrant.status === 403, opsGrant);
  } finally {
    console.log('\nCleanup');
    if (ventureId) await dev.call('DELETE', `/dev/ventures/${ventureId}?force=true`);
    const testUsers = await db.select({ id: users.id }).from(users).where(like(users.email, `%-${RUN}@e2e.meda.test`));
    if (testUsers.length) await db.delete(users).where(inArray(users.id, testUsers.map((u) => u.id)));
    console.log(`  removed venture and ${testUsers.length} test users`);
    await sqlClient.end();
  }

  console.log(failures === 0 ? '\nAll access checks passed.' : `\n${failures} check(s) FAILED.`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
