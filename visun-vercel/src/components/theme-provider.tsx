"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"
import { type ThemeProviderProps } from "next-themes/dist/types"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  const [mounted, setMounted] = useState(false)

  // Sync theme with Supabase when it changes
  const syncThemeToSupabase = async (theme: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (user) {
      const { error } = await supabase
        .from('user_preferences')
        .upsert({ 
          user_id: user.id, 
          theme: theme
        }, { 
          onConflict: 'user_id' 
        })
      
      if (error) {
        console.error('Error saving theme preference:', error)
      }
    }
  }

  // This effect prevents hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <NextThemesProvider
      {...props}
      attribute="class"
      defaultTheme="system"
      enableSystem
      onThemeChange={syncThemeToSupabase}
    >
      {children}
    </NextThemesProvider>
  )
}
