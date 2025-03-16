"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { SearchInput } from "@/components/SearchInput";
import { Footer } from "@/components/Footer";

export default function Home() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [generateAnimation, setGenerateAnimation] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(true);

  // Check for last visited page on component mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const lastPage = sessionStorage.getItem('lastPage');
      
      // If there was a last page and it was a chat page, redirect to it
      if (lastPage && lastPage.includes('/chat')) {
        router.push(lastPage);
      } else {
        // No last page to redirect to, show the home page
        setIsRedirecting(false);
      }
    }
  }, [router]);

  const handleSearch = (searchQuery: string, generateAnim: boolean = false) => {
    if (!searchQuery.trim()) return;
    
    // Create a new session immediately and navigate with query parameters
    // instead of relying on sessionStorage
    console.log("Search query:", searchQuery, "Generate animation:", generateAnim);
    
    // Redirect to chat page with encoded query parameters
    const params = new URLSearchParams();
    params.append('initialQuery', searchQuery);
    params.append('generateAnimation', String(generateAnim));
    
    router.push(`/chat?${params.toString()}`);
  };

  // Show a blank page while potentially redirecting to avoid flashing content
  if (isRedirecting) {
    return null;
  }

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-3xl flex flex-col items-center">
          <div className="text-center mt-8 mb-4">
            <h1 className="text-3xl font-semibold mb-2">Welcome to Visun.</h1>
            <p className="text-2xl text-muted-foreground">How can I help you today?</p>
          </div>

          <div className="w-full">
            <SearchInput onSendMessage={handleSearch} />
          </div>

          <Footer />
        </div>
      </main>
    </div>
  );
}
