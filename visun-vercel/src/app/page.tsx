"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function Home() {
  const router = useRouter()
  
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session) {
        // If logged in, redirect to the chat page
        router.push('/chat')
      } else {
        // If not logged in, redirect to login page
        router.push('/auth/login')
      }
    }
    
    checkSession()
  }, [router])
  
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="animate-pulse text-2xl text-muted-foreground">Loading...</div>
    </div>
  )
}
