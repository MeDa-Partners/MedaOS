import { relations } from 'drizzle-orm';
import { ventures } from './ventures';
import { departments } from './departments';
import { teams } from './teams';
import { sections } from './sections';
import { users } from './users';
import { userMemberships } from './user-memberships';
import { userSections } from './user-sections';
import { sessions } from './sessions';

export const venturesRelations = relations(ventures, ({ many }) => ({
  departments: many(departments),
  userMemberships: many(userMemberships),
}));

export const departmentsRelations = relations(departments, ({ one, many }) => ({
  venture: one(ventures, {
    fields: [departments.ventureId],
    references: [ventures.id],
  }),
  headUser: one(users, {
    fields: [departments.headUserId],
    references: [users.id],
  }),
  teams: many(teams),
  sections: many(sections),
  userMemberships: many(userMemberships),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  department: one(departments, {
    fields: [teams.departmentId],
    references: [departments.id],
  }),
  headUser: one(users, {
    fields: [teams.headUserId],
    references: [users.id],
  }),
  userMemberships: many(userMemberships),
}));

export const sectionsRelations = relations(sections, ({ one, many }) => ({
  department: one(departments, {
    fields: [sections.departmentId],
    references: [departments.id],
  }),
  userSections: many(userSections),
}));

export const usersRelations = relations(users, ({ many }) => ({
  userMemberships: many(userMemberships),
  userSections: many(userSections),
  sessions: many(sessions),
  departmentsLed: many(departments),
  teamsLed: many(teams),
}));

export const userMembershipsRelations = relations(userMemberships, ({ one }) => ({
  user: one(users, {
    fields: [userMemberships.userId],
    references: [users.id],
  }),
  venture: one(ventures, {
    fields: [userMemberships.ventureId],
    references: [ventures.id],
  }),
  department: one(departments, {
    fields: [userMemberships.departmentId],
    references: [departments.id],
  }),
  team: one(teams, {
    fields: [userMemberships.teamId],
    references: [teams.id],
  }),
}));

export const userSectionsRelations = relations(userSections, ({ one }) => ({
  user: one(users, {
    fields: [userSections.userId],
    references: [users.id],
  }),
  section: one(sections, {
    fields: [userSections.sectionId],
    references: [sections.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));
