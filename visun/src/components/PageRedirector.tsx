'use client';

import { useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

export function PageRedirector() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Only run this on the initial page load and only if we're on the home page
    if (typeof window !== 'undefined' && pathname === '/') {
      // Get the last visited path from localStorage
      const lastVisitedPath = localStorage.getItem('lastVisitedPath');
      
      // If there's a stored path and it's not the home page, redirect to it
      if (lastVisitedPath && lastVisitedPath !== '/' && !lastVisitedPath.startsWith('/?')) {
        router.push(lastVisitedPath);
      }
    }
  }, [pathname, router]);

  return null; // This component doesn't render anything
}
