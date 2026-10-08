import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { systemSections } from '../../db/schema';
import { ConflictError, NotFoundError } from '../../utils/errors';
import { CreateSectionInput, UpdateSectionInput } from './sections.validation';
import { SystemSectionResponse } from './sections.types';

export class SectionsService {
  /**
   * Lists all system sections in the database.
   */
  async listSections(): Promise<SystemSectionResponse[]> {
    return db.select().from(systemSections);
  }

  /**
   * Retrieves a section by its ID.
   */
  async getSectionById(id: string): Promise<SystemSectionResponse> {
    const records = await db
      .select()
      .from(systemSections)
      .where(eq(systemSections.id, id))
      .limit(1);

    if (records.length === 0) {
      throw new NotFoundError(`Section with ID ${id} not found`);
    }

    return records[0];
  }

  /**
   * Creates a new system section.
   */
  async createSection(input: CreateSectionInput): Promise<SystemSectionResponse> {
    const slug = input.slug.toLowerCase().trim();

    const existing = await db
      .select({ id: systemSections.id })
      .from(systemSections)
      .where(eq(systemSections.slug, slug))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictError(`System section with slug "${slug}" already exists`);
    }

    const [created] = await db
      .insert(systemSections)
      .values({
        name: input.name.trim(),
        slug,
        route: input.route.trim(),
        status: input.status,
      })
      .returning();

    return created;
  }

  /**
   * Updates an existing system section.
   */
  async updateSection(
    id: string,
    input: UpdateSectionInput
  ): Promise<SystemSectionResponse> {
    const existing = await db
      .select({ id: systemSections.id })
      .from(systemSections)
      .where(eq(systemSections.id, id))
      .limit(1);

    if (existing.length === 0) {
      throw new NotFoundError(`Section with ID ${id} not found`);
    }

    if (input.slug) {
      const slug = input.slug.toLowerCase().trim();
      const conflict = await db
        .select({ id: systemSections.id })
        .from(systemSections)
        .where(eq(systemSections.slug, slug))
        .limit(1);

      if (conflict.length > 0 && conflict[0].id !== id) {
        throw new ConflictError(`Section slug "${slug}" is already in use`);
      }
    }

    const [updated] = await db
      .update(systemSections)
      .set({
        ...(input.name && { name: input.name.trim() }),
        ...(input.slug && { slug: input.slug.toLowerCase().trim() }),
        ...(input.route && { route: input.route.trim() }),
        ...(input.status && { status: input.status }),
        updatedAt: new Date(),
      })
      .where(eq(systemSections.id, id))
      .returning();

    return updated;
  }
}

export const sectionsService = new SectionsService();
