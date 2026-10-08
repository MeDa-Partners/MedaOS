import { eq, and } from 'drizzle-orm';
import { db, sqlClient } from './index';
import {
  ventures,
  systemSections,
  ventureSections,
  teams,
  users,
  userVentures,
  userSections,
} from './schema';
import { hashPassword } from '../utils/crypto';
import { env } from '../config/env';

export async function seedDatabase() {
  console.log('Seeding MeDa OS database with venture-scoped organization & access model...');

  // 1. Initial Ventures
  const defaultVentures = [
    { name: 'Wayveda', slug: 'wayveda' },
    { name: 'Nature Mania', slug: 'nature-mania' },
  ];

  const ventureMap = new Map<string, string>(); // slug -> id
  for (const v of defaultVentures) {
    const existing = await db
      .select()
      .from(ventures)
      .where(eq(ventures.slug, v.slug))
      .limit(1);

    if (existing.length === 0) {
      const [inserted] = await db
        .insert(ventures)
        .values({
          name: v.name,
          slug: v.slug,
          status: 'active',
        })
        .returning();
      ventureMap.set(v.slug, inserted.id);
      console.log(`Created venture: ${v.name}`);
    } else {
      ventureMap.set(v.slug, existing[0].id);
      console.log(`Venture exists: ${v.name}`);
    }
  }

  // 2. System Sections Catalog
  const defaultSections = [
    { name: 'Sales', slug: 'sales', route: '/sales' },
    { name: 'Operations', slug: 'operations', route: '/operations' },
    { name: 'Orders', slug: 'orders', route: '/orders' },
    { name: 'NBD', slug: 'nbd', route: '/nbd' },
    { name: 'Employees', slug: 'employees', route: '/employees' },
    { name: 'Management', slug: 'management', route: '/management' },
  ];

  const sectionMap = new Map<string, string>(); // slug -> id
  for (const s of defaultSections) {
    const existing = await db
      .select()
      .from(systemSections)
      .where(eq(systemSections.slug, s.slug))
      .limit(1);

    if (existing.length === 0) {
      const [inserted] = await db
        .insert(systemSections)
        .values({
          name: s.name,
          slug: s.slug,
          route: s.route,
          status: 'active',
        })
        .returning();
      sectionMap.set(s.slug, inserted.id);
      console.log(`Created section: ${s.name}`);
    } else {
      await db
        .update(systemSections)
        .set({ name: s.name, route: s.route })
        .where(eq(systemSections.id, existing[0].id));
      sectionMap.set(s.slug, existing[0].id);
      console.log(`Section updated/exists: ${s.name}`);
    }
  }

  // 3. Venture Available Sections Mapping
  const ventureSectionsMapping: Record<string, string[]> = {
    wayveda: ['sales', 'orders', 'operations', 'nbd', 'employees', 'management'],
    'nature-mania': ['orders', 'operations', 'nbd', 'employees', 'management'], // Note: no sales section!
  };

  for (const [vSlug, sSlugs] of Object.entries(ventureSectionsMapping)) {
    const vId = ventureMap.get(vSlug);
    if (!vId) continue;

    for (const sSlug of sSlugs) {
      const sId = sectionMap.get(sSlug);
      if (!sId) continue;

      const existing = await db
        .select()
        .from(ventureSections)
        .where(
          and(
            eq(ventureSections.ventureId, vId),
            eq(ventureSections.sectionId, sId)
          )
        )
        .limit(1);

      if (existing.length === 0) {
        await db.insert(ventureSections).values({
          ventureId: vId,
          sectionId: sId,
        });
      }
    }
  }

  // 4. Teams per Venture
  // Wayveda: Sales, Operations, NBD
  // Nature Mania: Operations, NBD, Marketing
  const ventureTeamsConfig: Record<string, Array<{ name: string; slug: string }>> = {
    wayveda: [
      { name: 'Sales', slug: 'sales' },
      { name: 'Operations', slug: 'operations' },
      { name: 'NBD', slug: 'nbd' },
    ],
    'nature-mania': [
      { name: 'Operations', slug: 'operations' },
      { name: 'NBD', slug: 'nbd' },
      { name: 'Marketing', slug: 'marketing' },
    ],
  };

  const teamMap = new Map<string, string>(); // `${vSlug}:${tSlug}` -> id
  for (const [vSlug, tList] of Object.entries(ventureTeamsConfig)) {
    const vId = ventureMap.get(vSlug);
    if (!vId) continue;

    for (const t of tList) {
      const key = `${vSlug}:${t.slug}`;
      const existing = await db
        .select()
        .from(teams)
        .where(and(eq(teams.ventureId, vId), eq(teams.slug, t.slug)))
        .limit(1);

      if (existing.length === 0) {
        const [inserted] = await db
          .insert(teams)
          .values({
            ventureId: vId,
            name: t.name,
            slug: t.slug,
            status: 'active',
          })
          .returning();
        teamMap.set(key, inserted.id);
        console.log(`Created team: ${vSlug} -> ${t.name}`);
      } else {
        teamMap.set(key, existing[0].id);
      }
    }
  }

  // Helper function to assign user venture membership and team
  const assignUserToVentureTeam = async (
    userId: string,
    vSlug: string,
    tSlug: string
  ) => {
    const vId = ventureMap.get(vSlug);
    const tId = teamMap.get(`${vSlug}:${tSlug}`);
    if (!vId || !tId) return;

    const existing = await db
      .select()
      .from(userVentures)
      .where(and(eq(userVentures.userId, userId), eq(userVentures.ventureId, vId)))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(userVentures).values({
        userId,
        ventureId: vId,
        teamId: tId,
      });
    } else {
      await db
        .update(userVentures)
        .set({ teamId: tId })
        .where(eq(userVentures.id, existing[0].id));
    }
  };

  // Helper function to assign user section access within a venture
  const assignUserSectionsInVenture = async (
    userId: string,
    vSlug: string,
    sSlugs: string[]
  ) => {
    const vId = ventureMap.get(vSlug);
    if (!vId) return;

    for (const sSlug of sSlugs) {
      const sId = sectionMap.get(sSlug);
      if (!sId) continue;

      const existing = await db
        .select()
        .from(userSections)
        .where(
          and(
            eq(userSections.userId, userId),
            eq(userSections.ventureId, vId),
            eq(userSections.sectionId, sId)
          )
        )
        .limit(1);

      if (existing.length === 0) {
        await db.insert(userSections).values({
          userId,
          ventureId: vId,
          sectionId: sId,
        });
      }
    }
  };

  // 5. Seed Users
  // A. Admin Account
  const adminEmail = (env.ADMIN_INITIAL_EMAIL || 'admin@meda.com').toLowerCase().trim();
  let adminUserId = '';
  const existingAdmin = await db
    .select()
    .from(users)
    .where(eq(users.email, adminEmail))
    .limit(1);

  if (existingAdmin.length === 0) {
    const passwordHash = await hashPassword(env.ADMIN_INITIAL_PASSWORD || 'Admin@MeDa2026!');
    const [adminUser] = await db
      .insert(users)
      .values({
        name: 'System Administrator',
        email: adminEmail,
        passwordHash,
        isAdmin: true,
        status: 'active',
      })
      .returning();
    adminUserId = adminUser.id;
    console.log(`Created admin user: ${adminEmail}`);
  } else {
    adminUserId = existingAdmin[0].id;
    await db.update(users).set({ isAdmin: true }).where(eq(users.id, adminUserId));
  }

  // B. Rahul (Wayveda -> Sales team, Access: Sales, Orders; Nature Mania -> Operations team, Access: Operations, Orders)
  const rahulEmail = 'rahul@meda.com';
  let rahulUserId = '';
  const existingRahul = await db.select().from(users).where(eq(users.email, rahulEmail)).limit(1);
  if (existingRahul.length === 0) {
    const passwordHash = await hashPassword('Rahul@MeDa2026!');
    const [u] = await db
      .insert(users)
      .values({
        name: 'Rahul',
        email: rahulEmail,
        passwordHash,
        isAdmin: false,
        status: 'active',
      })
      .returning();
    rahulUserId = u.id;
    console.log(`Created employee: Rahul (${rahulEmail})`);
  } else {
    rahulUserId = existingRahul[0].id;
  }
  // Wayveda: Sales team, Access: Sales, Orders
  await assignUserToVentureTeam(rahulUserId, 'wayveda', 'sales');
  await assignUserSectionsInVenture(rahulUserId, 'wayveda', ['sales', 'orders']);
  // Nature Mania: Operations team, Access: Operations, Orders
  await assignUserToVentureTeam(rahulUserId, 'nature-mania', 'operations');
  await assignUserSectionsInVenture(rahulUserId, 'nature-mania', ['operations', 'orders']);

  // C. Amit (Wayveda -> Operations team; Nature Mania -> NBD team)
  const amitEmail = 'amit@meda.com';
  let amitUserId = '';
  const existingAmit = await db.select().from(users).where(eq(users.email, amitEmail)).limit(1);
  if (existingAmit.length === 0) {
    const passwordHash = await hashPassword('Amit@MeDa2026!');
    const [u] = await db
      .insert(users)
      .values({
        name: 'Amit',
        email: amitEmail,
        passwordHash,
        isAdmin: false,
        status: 'active',
      })
      .returning();
    amitUserId = u.id;
    console.log(`Created employee: Amit (${amitEmail})`);
  } else {
    amitUserId = existingAmit[0].id;
  }
  await assignUserToVentureTeam(amitUserId, 'wayveda', 'operations');
  await assignUserSectionsInVenture(amitUserId, 'wayveda', ['operations', 'orders']);
  await assignUserToVentureTeam(amitUserId, 'nature-mania', 'nbd');
  await assignUserSectionsInVenture(amitUserId, 'nature-mania', ['nbd', 'orders']);

  // D. Operations Head (Wayveda -> Operations team; Access: Operations, Orders, Employees)
  const opsHeadEmail = 'ops.head@meda.com';
  let opsHeadUserId = '';
  const existingOpsHead = await db.select().from(users).where(eq(users.email, opsHeadEmail)).limit(1);
  if (existingOpsHead.length === 0) {
    const passwordHash = await hashPassword('OpsHead@MeDa2026!');
    const [u] = await db
      .insert(users)
      .values({
        name: 'Operations Head',
        email: opsHeadEmail,
        passwordHash,
        isAdmin: false,
        status: 'active',
      })
      .returning();
    opsHeadUserId = u.id;
    console.log(`Created Operations Head (${opsHeadEmail})`);
  } else {
    opsHeadUserId = existingOpsHead[0].id;
  }
  await assignUserToVentureTeam(opsHeadUserId, 'wayveda', 'operations');
  await assignUserSectionsInVenture(opsHeadUserId, 'wayveda', ['operations', 'orders', 'employees']);

  // E. Sales Head (Wayveda -> Sales team; Access: Sales, Orders, Employees)
  const salesHeadEmail = 'sales.head@meda.com';
  let salesHeadUserId = '';
  const existingSalesHead = await db.select().from(users).where(eq(users.email, salesHeadEmail)).limit(1);
  if (existingSalesHead.length === 0) {
    const passwordHash = await hashPassword('SalesHead@MeDa2026!');
    const [u] = await db
      .insert(users)
      .values({
        name: 'Sales Head',
        email: salesHeadEmail,
        passwordHash,
        isAdmin: false,
        status: 'active',
      })
      .returning();
    salesHeadUserId = u.id;
    console.log(`Created Sales Head (${salesHeadEmail})`);
  } else {
    salesHeadUserId = existingSalesHead[0].id;
  }
  await assignUserToVentureTeam(salesHeadUserId, 'wayveda', 'sales');
  await assignUserSectionsInVenture(salesHeadUserId, 'wayveda', ['sales', 'orders', 'employees']);

  console.log('Database seeding finished successfully.');
}

if (require.main === module || process.argv[1]?.endsWith('seed.ts')) {
  seedDatabase()
    .then(async () => {
      await sqlClient.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('Seed script error:', err);
      await sqlClient.end();
      process.exit(1);
    });
}
