'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { type ThemeProviderProps as NextThemeProviderProps } from 'next-themes/dist/types';

export interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: string;
  attribute?: 'class' | 'data-theme' | 'data-mode';
}

export function ThemeProvider({ 
  children,
  defaultTheme = 'system',
  attribute = 'class',
  ...props
}: ThemeProviderProps) {
  return (
    <NextThemesProvider 
      attribute={attribute} 
      defaultTheme={defaultTheme}
      enableSystem
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}

export { useTheme } from 'next-themes';
