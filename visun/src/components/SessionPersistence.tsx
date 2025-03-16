'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export function SessionPersistence() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Save the current page and its parameters to sessionStorage
    if (typeof window !== 'undefined') {
      const currentPath = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '');
      
      // Only save chat pages to avoid overwriting with the home page during redirects
      if (pathname.includes('/chat')) {
        sessionStorage.setItem('lastPage', currentPath);
      }
    }
  }, [pathname, searchParams]);

  return null;
}
