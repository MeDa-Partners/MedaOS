'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Building2 } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { AppShell, FullScreenLoader } from '@/components/layout/app-shell';
import { EmptyState } from '@/components/ui/empty-state';

/** Entry point: send people to the home of their active venture. */
export default function RootPage() {
  const { isLoading, user, activeVenture } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && activeVenture) router.replace(`/${activeVenture.slug}`);
  }, [isLoading, activeVenture, router]);

  if (isLoading || !user || activeVenture) return <FullScreenLoader />;

  return (
    <AppShell title="Welcome">
      <EmptyState
        icon={Building2}
        title="You’re not part of a venture yet"
        description="An administrator or a department head needs to add you to a department before you can start working. Reach out to them and refresh this page once you’re added."
      />
    </AppShell>
  );
}
