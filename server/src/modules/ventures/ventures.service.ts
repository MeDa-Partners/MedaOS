import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { ventures, ventureSections, systemSections, teams } from '../../db/schema';
import { ConflictError, NotFoundError } from '../../utils/errors';
import { CreateVentureInput, UpdateVentureInput } from './ventures.validation';
import { VentureResponse } from './ventures.types';

export class VenturesService {
  /**
   * Lists all ventures including their active teams and available sections.
   */
  async listVentures(): Promise<VentureResponse[]> {
    const allVentures = await db.select().from(ventures);

    const result: VentureResponse[] = [];

    for (const v of allVentures) {
      const [vSections, vTeams] = await Promise.all([
        db
          .select({
            id: systemSections.id,
            name: systemSections.name,
            slug: systemSections.slug,
            route: systemSections.route,
          })
          .from(ventureSections)
          .innerJoin(systemSections, eq(ventureSections.sectionId, systemSections.id))
          .where(eq(ventureSections.ventureId, v.id)),

        db
          .select({
            id: teams.id,
            ventureId: teams.ventureId,
            name: teams.name,
            slug: teams.slug,
            status: teams.status,
          })
          .from(teams)
          .where(eq(teams.ventureId, v.id)),
      ]);

      result.push({
        ...v,
        sections: vSections,
        teams: vTeams,
      });
    }

    return result;
  }

  /**
   * Retrieves a single venture by ID with its configured sections and teams.
   */
  async getVentureById(id: string): Promise<VentureResponse> {
    const records = await db
      .select()
      .from(ventures)
      .where(eq(ventures.id, id))
      .limit(1);

    if (records.length === 0) {
      throw new NotFoundError(`Venture with ID ${id} not found`);
    }

    const v = records[0];

    const [vSections, vTeams] = await Promise.all([
      db
        .select({
          id: systemSections.id,
          name: systemSections.name,
          slug: systemSections.slug,
          route: systemSections.route,
        })
        .from(ventureSections)
        .innerJoin(systemSections, eq(ventureSections.sectionId, systemSections.id))
        .where(eq(ventureSections.ventureId, v.id)),

      db
        .select({
          id: teams.id,
          ventureId: teams.ventureId,
          name: teams.name,
          slug: teams.slug,
          status: teams.status,
        })
        .from(teams)
        .where(eq(teams.ventureId, v.id)),
    ]);

    return {
      ...v,
      sections: vSections,
      teams: vTeams,
    };
  }

  /**
   * Creates a new venture and optionally configures its initial sections.
   */
  async createVenture(input: CreateVentureInput): Promise<VentureResponse> {
    const slug = input.slug.toLowerCase().trim();

    const existing = await db
      .select({ id: ventures.id })
      .from(ventures)
      .where(eq(ventures.slug, slug))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictError(`Venture with slug "${slug}" already exists`);
    }

    const created = await db.transaction(async (tx) => {
      const [newVenture] = await tx
        .insert(ventures)
        .values({
          name: input.name.trim(),
          slug,
          status: input.status,
        })
        .returning();

      if (input.sectionIds && input.sectionIds.length > 0) {
        const uniqueSectionIds = Array.from(new Set(input.sectionIds));
        await tx.insert(ventureSections).values(
          uniqueSectionIds.map((sectionId) => ({
            ventureId: newVenture.id,
            sectionId,
          }))
        );
      }

      return newVenture;
    });

    return this.getVentureById(created.id);
  }

  /**
   * Updates an existing venture's name, slug, or status.
   */
  async updateVenture(
    id: string,
    input: UpdateVentureInput
  ): Promise<VentureResponse> {
    const existing = await db
      .select({ id: ventures.id })
      .from(ventures)
      .where(eq(ventures.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundError(`Venture with ID ${id} not found`);
    }

    if (input.slug) {
      const slug = input.slug.toLowerCase().trim();
      const conflict = await db
        .select({ id: ventures.id })
        .from(ventures)
        .where(eq(ventures.slug, slug))
        .limit(1);

      if (conflict.length > 0 && conflict[0].id !== id) {
        throw new ConflictError(`Venture slug "${slug}" is already in use`);
      }
    }

    await db
      .update(ventures)
      .set({
        ...(input.name && { name: input.name.trim() }),
        ...(input.slug && { slug: input.slug.toLowerCase().trim() }),
        ...(input.status && { status: input.status }),
        updatedAt: new Date(),
      })
      .where(eq(ventures.id, id));

    return this.getVentureById(id);
  }

  /**
   * Updates the available system sections enabled for a venture.
   */
  async setVentureSections(
    ventureId: string,
    sectionIds: string[]
  ): Promise<VentureResponse> {
    const existing = await db
      .select({ id: ventures.id })
      .from(ventures)
      .where(eq(ventures.id, ventureId))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundError(`Venture with ID ${ventureId} not found`);
    }

    const uniqueSectionIds = Array.from(new Set(sectionIds));

    await db.transaction(async (tx) => {
      // Remove old venture sections
      await tx
        .delete(ventureSections)
        .where(eq(ventureSections.ventureId, ventureId));

      // Insert new associations
      if (uniqueSectionIds.length > 0) {
        await tx.insert(ventureSections).values(
          uniqueSectionIds.map((sectionId) => ({
            ventureId,
            sectionId,
          }))
        );
      }
    });

    return this.getVentureById(ventureId);
  }
}

export const venturesService = new VenturesService();
