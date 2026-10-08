'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect old /admin route to the dedicated /employees management section
    router.replace('/employees');
  }, [router]);

  return null;
}
