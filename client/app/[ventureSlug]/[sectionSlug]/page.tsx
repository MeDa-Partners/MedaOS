'use client';

import { use } from 'react';
import { Hammer, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/use-async';
import { useVentureFromSlug } from '@/lib/use-venture';
import { useAuth } from '@/context/auth-context';
import { AppShell, NoAccess } from '@/components/layout/app-shell';
import { resolveSectionModule } from '@/sections/registry';

/**
 * Hosts every section at /{venture}/{section}. The server decides access (per user);
 * the section module registry decides what renders.
 */
export default function SectionPage({ params }: { params: Promise<{ ventureSlug: string; sectionSlug: string }> }) {
  const { ventureSlug, sectionSlug } = use(params);
  const { user } = useAuth();
  useVentureFromSlug(ventureSlug);

  const { data: access, error, loading } = useAsync(
    () => api.sections.checkAccess(ventureSlug, sectionSlug),
    [ventureSlug, sectionSlug],
    !!user
  );

  const section = access?.section;
  const title = section?.name ?? 'Section';

  if (loading || (!access && !error)) {
    return (
      <AppShell title={title}>
        <div className="flex items-center justify-center gap-2 py-24 text-xs text-[#71717a]">
          <Loader2 className="w-4 h-4 animate-spin" /> Checking your access…
        </div>
      </AppShell>
    );
  }

  if (error || !access?.allowed || !section) {
    return (
      <AppShell title={title}>
        <NoAccess title="You can’t open this section" message={error || access?.reason || 'Access denied.'} />
      </AppShell>
    );
  }

  const sectionModule = resolveSectionModule(section.ventureSlug, section.slug);

  return (
    <AppShell title={section.name} description={`${section.ventureName} · ${section.departmentName}`} wide={!!sectionModule}>
      {sectionModule ? (
        <sectionModule.component
          venture={{ id: section.ventureId, name: section.ventureName, slug: section.ventureSlug }}
          section={{
            id: section.id,
            name: section.name,
            slug: section.slug,
            departmentId: section.departmentId,
            departmentName: section.departmentName,
          }}
        />
      ) : (
        <div className="max-w-lg mx-auto mt-12 text-center rounded-2xl border border-[#e4e4e7] bg-white p-8 shadow-2xs">
          <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto mb-4">
            <Hammer className="w-5 h-5" />
          </div>
          <h2 className="text-sm font-semibold text-[#09090b]">{section.name} is being built</h2>
          <p className="text-xs text-[#71717a] leading-relaxed mt-1.5">
            You have access to this section. Its tools haven’t been released for {section.ventureName} yet. They will
            show up here as soon as they are.
          </p>
          <p className="mt-5 text-[11px] font-mono text-[#a1a1aa]">
            module key: {section.ventureSlug}/{section.slug} or {section.slug}
          </p>
        </div>
      )}
    </AppShell>
  );
}
