import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { processSettings } from '../../db/schema';
import { DeadlineSettings, parseTimeOfDay } from './deadlines';

/**
 * A venture's office hours and deadlines. The row is created with the defaults
 * (09:00 / 18:00 / 11:00 / 5 min / 30 min) the first time it is needed.
 */
export async function getDeadlineSettings(ventureId: string): Promise<DeadlineSettings> {
  await db.insert(processSettings).values({ ventureId }).onConflictDoNothing();
  const [row] = await db.select().from(processSettings).where(eq(processSettings.ventureId, ventureId)).limit(1);
  return {
    officeStartMinute: parseTimeOfDay(row.officeStart),
    officeEndMinute: parseTimeOfDay(row.officeEnd),
    overnightDeadlineMinute: parseTimeOfDay(row.overnightDeadline),
    verificationTatMinutes: row.verificationTatMinutes,
    portalTatMinutes: row.portalTatMinutes,
  };
}
