'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { GrokLogo } from "@/components/GrokLogo";
import { Settings, LogOut } from "lucide-react";
import { ChatSidebar } from "@/components/ChatSidebar";
import { useAuth } from "@/lib/auth/AuthProvider";
import { ThemeToggle } from "@/components/ThemeToggle";

export function Header() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, signOut, isLoading } = useAuth();
  const router = useRouter();
  
  // Use this pattern to avoid hydration mismatch
  const [clientReady, setClientReady] = useState(false);
  
  useEffect(() => {
    // Use requestIdleCallback for smoother mounting after hydration
    if (typeof window !== 'undefined') {
      // Use requestAnimationFrame for smoother mounting after hydration
      // This helps ensure a stable DOM before revealing auth components
      const id = window.requestAnimationFrame(() => {
        setClientReady(true);
      });
      return () => window.cancelAnimationFrame(id);
    }
  }, []);

  // Get base URL dynamically to avoid hard-coding the port
  const getBaseUrl = () => {
    // Safer approach that prevents hydration mismatch
    return '/';
  };

  const handleSignOut = async () => {
    await signOut();
  };
  
  // Dedicated function for homepage navigation
  const navigateToHomepage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Try Next.js navigation first
    router.push('/');
  };

  // Prepare content outside of JSX for cleaner code and fewer conditionals
  const renderAuthButton = () => {
    // Not ready to show anything yet (server-side or early hydration)
    if (!clientReady) {
      return <div className="w-20 h-9"></div>; // Placeholder with same dimensions
    }
    
    // Still loading auth state
    if (isLoading) {
      return <div className="w-20 h-9"></div>; // Placeholder with same dimensions
    }
    
    // User is logged in
    if (user) {
      return (
        <Button 
          variant="ghost" 
          size="icon" 
          className="rounded-full"
          onClick={handleSignOut}
          title="Sign out"
        >
          <LogOut className="h-5 w-5" />
        </Button>
      );
    }
    
    // User is not logged in
    return (
      <Link href="/auth">
        <Button variant="outline" size="sm">
          Sign in
        </Button>
      </Link>
    );
  };

  return (
    <>
      <header className="border-b border-border/40 py-4">
        <div className="container flex items-center justify-between">
          <Link
            href="/"
            className="cursor-pointer no-underline"
            onClick={(e) => {
              e.preventDefault();
              router.push("/");
            }}
          >
            <GrokLogo />
          </Link>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/settings">
              <Button variant="ghost" size="icon" className="rounded-full">
                <Settings className="h-5 w-5" />
              </Button>
            </Link>
            <Button 
              variant="ghost" 
              size="icon" 
              className="rounded-full"
              onClick={() => setSidebarOpen(true)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </Button>
            
            {/* Auth button with more stable rendering */}
            {renderAuthButton()}
          </div>
        </div>
      </header>

      <ChatSidebar 
        open={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />
    </>
  );
}
