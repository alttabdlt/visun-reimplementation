"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Settings, LogOut } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { toast } from "react-hot-toast"

interface HeaderProps {
  user: any
}

export default function Header({ user }: HeaderProps) {
  const router = useRouter()
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

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
    <header className="border-b bg-card px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Visun</h1>
        </div>

        <div className="flex items-center space-x-2">
          <ThemeToggle />
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className="h-9 w-9 rounded-md"
            aria-label="Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSignOut}
            className="h-9 w-9 rounded-md"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {isSettingsOpen && (
        <div className="mt-2 rounded-md border bg-background p-4 shadow-sm">
          <h2 className="mb-2 font-medium">Settings</h2>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">Account: {user?.email}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm">Theme</span>
              <ThemeToggle />
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
