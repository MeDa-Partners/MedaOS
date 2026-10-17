'use client';

import { api, Department, Section, Team } from './api';
import { useAsync } from './use-async';

export interface VentureOrg {
  departments: Department[];
  teams: Team[];
  sections: Section[];
}

/** Departments, teams and sections of a venture that the caller is allowed to see. */
export function useVentureOrg(ventureId: string | undefined) {
  return useAsync<VentureOrg>(
    async () => {
      const [departments, teams, sections] = await Promise.all([
        api.departments.list(ventureId),
        api.teams.list({ ventureId }),
        api.sections.list({ ventureId }),
      ]);
      return { departments, teams, sections };
    },
    [ventureId],
    !!ventureId
  );
}
