import { and, asc, eq, inArray, sql, SQL } from 'drizzle-orm';
import { db } from '../../db';
import { sections, departments, ventures, userMemberships, userSections } from '../../db/schema';
import { NotFoundError } from '../../utils/errors';
import { Actor, loadAuthority, resolveSectionAccess, SectionAccessResult } from '../../utils/access';
import { SectionDetail } from './sections.types';

/**
 * Sections are catalog records created in /dev, each backed by a coded module in the client.
 * This service reads them and answers "may this user open this section?".
 */
export class SectionsService {
  async listSections(
    options: { departmentId?: string; ventureId?: string },
    actor: Actor
  ): Promise<SectionDetail[]> {
    const auth = await loadAuthority(actor);
    const conditions: (SQL | undefined)[] = [
      options.departmentId ? eq(sections.departmentId, options.departmentId) : undefined,
      options.ventureId ? eq(departments.ventureId, options.ventureId) : undefined,
    ];

    if (!auth.isAdmin) {
      // Non-admins see the catalog of departments they belong to (needed to grant access).
      const rows = await db
        .select({ departmentId: userMemberships.departmentId })
        .from(userMemberships)
        .where(eq(userMemberships.userId, actor.id));
      const visible = Array.from(new Set([...rows.map((r) => r.departmentId), ...auth.departmentsLed]));
      if (visible.length === 0) return [];
      conditions.push(inArray(sections.departmentId, visible), eq(sections.status, 'active'));
    }

    const rows = await db
      .select({
        id: sections.id,
        departmentId: sections.departmentId,
        departmentName: departments.name,
        departmentSlug: departments.slug,
        ventureId: departments.ventureId,
        ventureName: ventures.name,
        ventureSlug: ventures.slug,
        name: sections.name,
        slug: sections.slug,
        status: sections.status,
        createdAt: sections.createdAt,
        updatedAt: sections.updatedAt,
      })
      .from(sections)
      .innerJoin(departments, eq(sections.departmentId, departments.id))
      .innerJoin(ventures, eq(departments.ventureId, ventures.id))
      .where(and(...conditions))
      .orderBy(asc(departments.name), asc(sections.name));

    const ids = rows.map((r) => r.id);
    const counts = ids.length
      ? await db
          .select({ sectionId: userSections.sectionId, count: sql<number>`count(*)::int` })
          .from(userSections)
          .where(inArray(userSections.sectionId, ids))
          .groupBy(userSections.sectionId)
      : [];
    const countMap = new Map(counts.map((c) => [c.sectionId, c.count]));

    return rows.map((r) => ({
      ...r,
      route: `/${r.ventureSlug}/${r.slug}`,
      status: r.status as 'active' | 'inactive',
      userCount: countMap.get(r.id) || 0,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  async getSection(id: string, actor: Actor): Promise<SectionDetail> {
    const [section] = (await this.listSections({}, actor)).filter((s) => s.id === id);
    if (!section) throw new NotFoundError('Section not found');
    return section;
  }

  checkAccess(actor: Actor, ventureIdentifier: string, sectionSlug: string): Promise<SectionAccessResult> {
    return resolveSectionAccess(actor, ventureIdentifier, sectionSlug);
  }
}

export const sectionsService = new SectionsService();
