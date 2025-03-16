"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";

interface ChatSession {
  session_id: string;
  created_at: string;
  first_message: string;
  user_id?: string;
}

interface ChatSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function ChatSidebar({ open, onClose }: ChatSidebarProps) {
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [clientReady, setClientReady] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState(0);
  const supabase = createClient();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  // Improved client-side hydration check with requestAnimationFrame
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Use requestAnimationFrame for smoother mounting after hydration
      const id = window.requestAnimationFrame(() => {
        setClientReady(true);
      });
      return () => window.cancelAnimationFrame(id);
    }
  }, []);

  // Use useCallback to prevent recreating the function on each render
  const fetchChatSessions = useCallback(async () => {
    // Don't attempt to fetch if we're not fully mounted or user auth is still loading
    if (!clientReady || authLoading) {
      return;
    }
    
    // Don't fetch if user isn't logged in
    if (!user) {
      // Don't set state here - that's causing an infinite loop
      // setChatSessions([]); - REMOVED THIS LINE
      return;
    }
    
    // Prevent multiple near-simultaneous fetches (debounce)
    const now = Date.now();
    if (now - lastFetchTime < 300) { // 300ms debounce
      return;
    }
    setLastFetchTime(now);

    // Set loading state
    setLoading(true);
    setError(null);
    
    try {
      // Get chat sessions ordered by creation date
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('*') // Select all columns
        .eq('user_id', user.id) // Only fetch sessions for this user
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Error fetching chat sessions: ${error.message}`);
      } else {
        // Ensure data conforms to the ChatSession interface
        const typedData: ChatSession[] = Array.isArray(data) 
          ? data.map(item => ({
              session_id: String(item.session_id || ''),
              created_at: String(item.created_at || ''),
              first_message: String(item.first_message || ''),
              user_id: item.user_id ? String(item.user_id) : undefined
            }))
          : [];
        setChatSessions(typedData);
      }
    } catch (err) {
      console.error('Error in fetchChatSessions:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setChatSessions([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, user, authLoading, clientReady, lastFetchTime]);

  // Use a ref to track if we've already fetched for this user
  const fetchedForUserRef = useRef<string | null>(null);
  
  // Effect to fetch chat sessions when the sidebar is opened
  useEffect(() => {
    // Prevent unnecessary fetches by tracking if we've already fetched for this user
    const shouldFetch = open && 
                       clientReady && 
                       !authLoading && 
                       user && 
                       fetchedForUserRef.current !== user.id;
    
    if (shouldFetch) {
      fetchedForUserRef.current = user.id;
      fetchChatSessions();
    }
    
    // Clear sessions when sidebar is opened but no user is logged in
    // Only do this once when user becomes null, not on every render
    if (open && clientReady && !authLoading && !user && fetchedForUserRef.current !== null) {
      fetchedForUserRef.current = null;
      setChatSessions([]);
    }
  }, [open, fetchChatSessions, clientReady, authLoading, user]);

  async function deleteChat(sessionId: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user) return;
    
    try {
      // First delete all messages associated with this session
      const { error: messagesError } = await supabase
        .from('chat_messages')
        .delete()
        .eq('session_id', sessionId);
      
      if (messagesError) {
        throw messagesError;
      }
      
      // Then delete the session itself
      const { error: sessionError } = await supabase
        .from('chat_sessions')
        .delete()
        .eq('session_id', sessionId);
      
      if (sessionError) {
        throw sessionError;
      }
      
      // Update the UI
      setChatSessions(prevSessions => 
        prevSessions.filter(session => session.session_id !== sessionId)
      );
      
      toast.success('Chat deleted successfully');
    } catch (error) {
      console.error('Error deleting chat:', error);
      toast.error('Failed to delete chat');
    }
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  // Function to navigate to chat
  const navigateToChat = (sessionId: string, e: React.MouseEvent) => {
    e.preventDefault();
    onClose(); // Close sidebar first
    router.push(`/chat?session=${sessionId}`);
  };

  // Use memoization for each UI state to prevent re-renders
  const loadingUI = useMemo(() => (
    <div className="flex justify-center items-center h-40">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  ), []);
  
  const errorUI = useMemo(() => error && (
    <div className="text-center py-8 text-destructive">
      <p>Error loading chat history</p>
      <p className="text-sm mt-2">{error.message}</p>
      <Button 
        variant="outline" 
        size="sm" 
        className="mt-4"
        onClick={() => fetchChatSessions()}
      >
        Try Again
      </Button>
    </div>
  ), [error, fetchChatSessions]);
  
  const notLoggedInUI = useMemo(() => (
    <div className="text-center py-8 text-muted-foreground">
      <p>Sign in to view chat history</p>
      <Button 
        variant="outline" 
        size="sm" 
        className="mt-4"
        onClick={() => router.push('/auth')}
      >
        Sign In
      </Button>
    </div>
  ), [router]);
  
  const noSessionsUI = useMemo(() => (
    <div className="text-center py-8 text-muted-foreground">
      <p>No chat history found</p>
      <p className="text-sm mt-2">Start a new conversation from the home page</p>
    </div>
  ), []);
  
  // Memoize the session list to prevent re-renders
  const sessionListUI = useMemo(() => chatSessions.length > 0 && (
    <div className="space-y-2">
      {chatSessions.map((session) => (
        <div
          key={session.session_id}
          onClick={(e) => navigateToChat(session.session_id, e)}
          className="flex justify-between items-center rounded-lg border border-border p-3 hover:bg-accent transition-colors cursor-pointer"
        >
          <div className="flex-1 overflow-hidden">
            <p className="font-medium truncate">{session.first_message}</p>
            <p className="text-xs text-muted-foreground">{formatDate(session.created_at)}</p>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={(e) => deleteChat(session.session_id, e)}
            title="Delete chat"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  ), [chatSessions, navigateToChat, deleteChat]);
  
  // Simplified render helper function that uses memoized components
  const renderContent = () => {
    // Show loading state during initialization or while data is loading
    if (!clientReady || authLoading || loading) {
      return loadingUI;
    }
    
    // Error state
    if (error) {
      return errorUI;
    }
    
    // Not logged in
    if (!user) {
      return notLoggedInUI;
    }
    
    // Has chat sessions
    if (chatSessions.length > 0) {
      return sessionListUI;
    }
    
    // No chat sessions
    return noSessionsUI;
  };

  // Guard against flash of content during SSR
  const shouldShowSidebar = clientReady && open;

  return (
    <div
      className={`fixed inset-0 z-50 bg-background/80 backdrop-blur-sm transform transition-transform duration-300 ${
        shouldShowSidebar ? "translate-x-0" : "translate-x-full"
      }`}
      style={{ pointerEvents: shouldShowSidebar ? 'auto' : 'none' }}
    >
      <div className="fixed right-0 top-0 h-full w-full max-w-xs border-l border-border bg-background p-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Chat History</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        {/* Content area with simplified rendering logic */}
        {renderContent()}
      </div>
    </div>
  );
}
