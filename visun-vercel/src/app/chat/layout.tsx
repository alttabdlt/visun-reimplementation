"use client"

import { useEffect, useState } from "react"
import { redirect, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import Header from "@/components/Header"
import ChatSidebar from "@/components/ChatSidebar"

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser()
        
        if (error || !user) {
          router.push("/auth/login")
          return
        }
        
        setUser(user)
      } catch (error) {
        console.error("Error checking session:", error)
        router.push("/auth/login")
      } finally {
        setLoading(false)
      }
    }
    
    checkSession()
    
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_OUT") {
          router.push("/auth/login")
        } else if (session?.user) {
          setUser(session.user)
        }
      }
    )
    
    return () => {
      subscription.unsubscribe()
    }
  }, [router])
  
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-2xl text-muted-foreground">Loading...</div>
      </div>
    )
  }
  
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <ChatSidebar userId={user?.id} />
      
      <div className="flex flex-1 flex-col">
        <Header user={user} />
        
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  )
}
