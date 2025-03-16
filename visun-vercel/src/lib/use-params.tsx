'use client';

import { use } from 'react';

/**
 * A utility hook to safely unwrap Next.js route parameters
 * This solves the warning: "A param property was accessed directly with `params.id`"
 * 
 * @param params The params object from the page props
 * @returns The unwrapped params object
 */
export function useParams<T extends { id: string }>(params: T): T {
  // Create a new object to avoid modifying the original
  const result = { ...params } as T;
  
  // Safely unwrap the id parameter with React.use()
  result.id = use(Promise.resolve(params.id));
  
  return result;
}
