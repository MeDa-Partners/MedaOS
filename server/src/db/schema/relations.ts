import { relations } from 'drizzle-orm';
import { ventures } from './ventures';
import { systemSections } from './sections';
import { ventureSections } from './venture-sections';
import { teams } from './teams';
import { users } from './users';
import { userVentures } from './user-ventures';
import { userSections } from './user-sections';
import { sessions } from './sessions';

export const venturesRelations = relations(ventures, ({ many }) => ({
  teams: many(teams),
  ventureSections: many(ventureSections),
  userVentures: many(userVentures),
  userSections: many(userSections),
}));

export const systemSectionsRelations = relations(systemSections, ({ many }) => ({
  ventureSections: many(ventureSections),
  userSections: many(userSections),
}));

export const ventureSectionsRelations = relations(ventureSections, ({ one }) => ({
  venture: one(ventures, {
    fields: [ventureSections.ventureId],
    references: [ventures.id],
  }),
  section: one(systemSections, {
    fields: [ventureSections.sectionId],
    references: [systemSections.id],
  }),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  venture: one(ventures, {
    fields: [teams.ventureId],
    references: [ventures.id],
  }),
  userVentures: many(userVentures),
}));

export const usersRelations = relations(users, ({ many }) => ({
  userVentures: many(userVentures),
  userSections: many(userSections),
  sessions: many(sessions),
}));

export const userVenturesRelations = relations(userVentures, ({ one }) => ({
  user: one(users, {
    fields: [userVentures.userId],
    references: [users.id],
  }),
  venture: one(ventures, {
    fields: [userVentures.ventureId],
    references: [ventures.id],
  }),
  team: one(teams, {
    fields: [userVentures.teamId],
    references: [teams.id],
  }),
}));

export const userSectionsRelations = relations(userSections, ({ one }) => ({
  user: one(users, {
    fields: [userSections.userId],
    references: [users.id],
  }),
  venture: one(ventures, {
    fields: [userSections.ventureId],
    references: [ventures.id],
  }),
  section: one(systemSections, {
    fields: [userSections.sectionId],
    references: [systemSections.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));
