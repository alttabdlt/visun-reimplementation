"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Settings, LogOut, PlusSquare } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import ChatSidebar from "@/components/ChatSidebar" 
import { toast } from "react-hot-toast"

export default function Header() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data, error } = await supabase.auth.getUser()
        
        if (!error && data.user) {
          setUser(data.user)
        }
      } catch (error) {
        console.error("Error checking user:", error)
      } finally {
        setLoading(false)
      }
    }
    
    checkUser()
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_OUT") {
          setUser(null)
          router.push("/auth/login")
        } else if (session) {
          setUser(session.user)
        }
      }
    )
    
    return () => {
      subscription.unsubscribe()
    }
  }, [router])

  const handleNewChat = () => {
    router.push("/chat")
  }

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        throw error
      }
      
      toast.success("Signed out successfully")
      router.push("/auth/login")
    } catch (error) {
      console.error("Error signing out:", error)
      toast.error("Failed to sign out")
    }
  }

  return (
    <header className="border-b bg-background/90 backdrop-blur-sm px-4 py-3 sticky top-0 z-10">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-2xl font-bold tracking-tight hover:opacity-80 transition-opacity">
            Visun
          </Link>
          
          {user && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(true)}
              className="hidden md:flex items-center gap-1"
            >
              <span>Your Chats</span>
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {user && (
            <>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNewChat}
                title="New Chat"
              >
                <PlusSquare className="h-5 w-5" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push("/settings")}
                title="Settings"
              >
                <Settings className="h-5 w-5" />
              </Button>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSignOut}
                title="Sign Out"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </>
          )}
          
          <ThemeToggle />
        </div>
      </div>
      
      {user && (
        <ChatSidebar 
          open={sidebarOpen} 
          onClose={() => setSidebarOpen(false)} 
        />
      )}
    </header>
  )
}
