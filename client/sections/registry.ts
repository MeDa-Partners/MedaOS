/**
 * Section module registry — where coded sections plug into MeDa OS.
 *
 * A section is created as a catalog record in /dev (venture → department → section) and is
 * opened at /{ventureSlug}/{sectionSlug}. Access is checked by the server before anything
 * renders. This registry decides WHAT renders once access is granted.
 *
 * To build a section:
 *   1. Create a folder, e.g. `sections/leads/` with an `index.tsx` default-exporting a component
 *      that receives `SectionModuleProps`.
 *   2. Register it below. Keys are either:
 *        - '<section-slug>'                → used by every venture that has a section with that slug
 *        - '<venture-slug>/<section-slug>' → used only in that venture (wins over the generic key)
 *   3. Server routes for the section go in `server/src/modules/<name>/` and are guarded with
 *      `requireSection('<section-slug>')`, so the API enforces the same per-user access.
 *
 *   import dynamic from 'next/dynamic';
 *   export const SECTION_MODULES: Record<string, SectionModule> = {
 *     leads: { component: dynamic(() => import('./leads')) },
 *     'wayveda/orders': { component: dynamic(() => import('./wayveda-orders')) },
 *   };
 *
 * Sections without a module show a "not built yet" screen to people who have access.
 */
import type { ComponentType } from 'react';
import dynamic from 'next/dynamic';

export interface SectionModuleProps {
  venture: { id: string; name: string; slug: string };
  section: { id: string; name: string; slug: string; departmentId: string; departmentName: string };
}

export interface SectionModule {
  component: ComponentType<SectionModuleProps>;
}

export const SECTION_MODULES: Record<string, SectionModule> = {
  // WayVeda COD verification (server: modules/orders, modules/shopify)
  'wayveda/orders': { component: dynamic(() => import('./orders')) },
  'wayveda/verification': { component: dynamic(() => import('./verification')) },
  'wayveda/portal-actions': { component: dynamic(() => import('./portal-actions')) },
  'wayveda/shifts': { component: dynamic(() => import('./shifts')) },
};

export function resolveSectionModule(ventureSlug: string, sectionSlug: string): SectionModule | null {
  return SECTION_MODULES[`${ventureSlug}/${sectionSlug}`] ?? SECTION_MODULES[sectionSlug] ?? null;
}

export function isSectionModuleBuilt(ventureSlug: string, sectionSlug: string): boolean {
  return resolveSectionModule(ventureSlug, sectionSlug) !== null;
}
