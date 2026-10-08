import { eq, and } from 'drizzle-orm';
import { db } from '../../db';
import { teams, ventures } from '../../db/schema';
import {
  ConflictError,
  NotFoundError,
  BadRequestError,
} from '../../utils/errors';
import {
  CreateTeamInput,
  UpdateTeamInput,
} from './teams.validation';
import { TeamDetail } from './teams.types';

export class TeamsService {
  /**
   * Lists all teams, optionally filtered by venture.
   */
  async listTeams(ventureId?: string): Promise<TeamDetail[]> {
    const query = db
      .select({
        id: teams.id,
        ventureId: teams.ventureId,
        name: teams.name,
        slug: teams.slug,
        status: teams.status,
        createdAt: teams.createdAt,
        updatedAt: teams.updatedAt,
        ventureName: ventures.name,
        ventureSlug: ventures.slug,
      })
      .from(teams)
      .innerJoin(ventures, eq(teams.ventureId, ventures.id));

    if (ventureId) {
      query.where(eq(teams.ventureId, ventureId));
    }

    const rows = await query;

    return rows.map((r) => ({
      id: r.id,
      ventureId: r.ventureId,
      name: r.name,
      slug: r.slug,
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      venture: {
        id: r.ventureId,
        name: r.ventureName,
        slug: r.ventureSlug,
      },
    }));
  }

  /**
   * Retrieves a single team by ID.
   */
  async getTeamById(id: string): Promise<TeamDetail> {
    const rows = await db
      .select({
        id: teams.id,
        ventureId: teams.ventureId,
        name: teams.name,
        slug: teams.slug,
        status: teams.status,
        createdAt: teams.createdAt,
        updatedAt: teams.updatedAt,
        ventureName: ventures.name,
        ventureSlug: ventures.slug,
      })
      .from(teams)
      .innerJoin(ventures, eq(teams.ventureId, ventures.id))
      .where(eq(teams.id, id))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundError(`Team with ID ${id} not found`);
    }

    const r = rows[0];

    return {
      id: r.id,
      ventureId: r.ventureId,
      name: r.name,
      slug: r.slug,
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      venture: {
        id: r.ventureId,
        name: r.ventureName,
        slug: r.ventureSlug,
      },
    };
  }

  /**
   * Creates a new team inside a venture.
   */
  async createTeam(input: CreateTeamInput): Promise<TeamDetail> {
    const slug = input.slug.toLowerCase().trim();

    // Verify venture exists
    const [v] = await db
      .select({ id: ventures.id })
      .from(ventures)
      .where(eq(ventures.id, input.ventureId))
      .limit(1);

    if (!v) {
      throw new BadRequestError(`Venture with ID ${input.ventureId} does not exist`);
    }

    // Check unique (venture_id, slug)
    const existing = await db
      .select({ id: teams.id })
      .from(teams)
      .where(and(eq(teams.ventureId, input.ventureId), eq(teams.slug, slug)))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictError(
        `Team with slug "${slug}" already exists in this venture`
      );
    }

    const [newTeam] = await db
      .insert(teams)
      .values({
        ventureId: input.ventureId,
        name: input.name.trim(),
        slug,
        status: input.status ?? 'active',
      })
      .returning();

    return this.getTeamById(newTeam.id);
  }

  /**
   * Updates a team's attributes.
   */
  async updateTeam(id: string, input: UpdateTeamInput): Promise<TeamDetail> {
    const [existing] = await db
      .select()
      .from(teams)
      .where(eq(teams.id, id))
      .limit(1);

    if (!existing) {
      throw new NotFoundError(`Team with ID ${id} not found`);
    }

    const targetVentureId = input.ventureId || existing.ventureId;

    if (input.slug) {
      const slug = input.slug.toLowerCase().trim();
      const conflict = await db
        .select({ id: teams.id })
        .from(teams)
        .where(and(eq(teams.ventureId, targetVentureId), eq(teams.slug, slug)))
        .limit(1);

      if (conflict.length > 0 && conflict[0].id !== id) {
        throw new ConflictError(
          `Team slug "${slug}" is already in use in this venture`
        );
      }
    }

    await db
      .update(teams)
      .set({
        ...(input.ventureId && { ventureId: input.ventureId }),
        ...(input.name && { name: input.name.trim() }),
        ...(input.slug && { slug: input.slug.toLowerCase().trim() }),
        ...(input.status && { status: input.status }),
        updatedAt: new Date(),
      })
      .where(eq(teams.id, id));

    return this.getTeamById(id);
  }
}

export const teamsService = new TeamsService();
