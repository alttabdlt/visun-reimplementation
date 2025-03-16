'use client';

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { User, Session } from '@supabase/supabase-js';
import { toast } from "sonner";

// Define the AuthContext type
type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  error: Error | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

// Create the context with default values
const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isLoading: true,
  error: null,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
});

// Hook to use the auth context
export const useAuth = () => useContext(AuthContext);

// Provider component that wraps your app and provides the auth context
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const router = useRouter();
  const supabase = createClient();

  // Initialize auth state - completely redesigned to eliminate flickering
  useEffect(() => {
    // Don't set loading=true here - keep existing state until we have data
    // This avoids the loading -> no user -> loading -> user sequence that causes flickering
    
    let mounted = true;
    let initialSessionChecked = false;
    
    // Get session from Supabase - single source of truth
    const getSession = async () => {
      if (!mounted) return;
      
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        // Store all updates to apply them in a single batch
        const updates: {
          user: User | null,
          session: Session | null,
          error: Error | null,
          isLoading?: boolean
        } = {
          user: null,
          session: null,
          error: null
        };
        
        if (sessionError) {
          console.warn('Error getting session:', sessionError.message);
          updates.error = sessionError;
        } else if (session) {
          // Success case - we have a session
          updates.session = session;
          updates.user = session.user;
        }
        
        // Only change loading state when we're done with initial check
        if (!initialSessionChecked && mounted) {
          initialSessionChecked = true;
          updates.isLoading = false;
        }
        
        // Apply all state updates at once to reduce re-renders
        setUser(updates.user);
        setSession(updates.session);
        setError(updates.error);
        if (updates.isLoading !== undefined) {
          setIsLoading(updates.isLoading);
        }
      } catch (error) {
        if (!mounted) return;
        
        console.error('Unexpected auth error:', error);
        
        // Apply all state updates at once to reduce re-renders
        setUser(null);
        setSession(null);
        setError(error instanceof Error ? error : new Error('Unknown auth error'));
        
        // Only change loading state when we're done with initial check
        if (!initialSessionChecked && mounted) {
          initialSessionChecked = true;
          setIsLoading(false);
        }
      }
    };

    // Set up the auth state change listener
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;
        
        // Handle auth state changes without flicker by not updating loading state
        if (newSession) {
          // Use a ref to store previous session to prevent unnecessary updates
          if (JSON.stringify(newSession) !== JSON.stringify(session)) {
            // Only update state if the session actually changed
            setSession(newSession);
            setUser(newSession.user);
            setError(null);
            
            // Refresh the page to reflect any changes in RLS
            if (event === 'SIGNED_IN') {
              router.refresh();
            }
          }
        } else if (session !== null) {
          // Only update if we're transitioning from having a session to not having one
          setSession(null);
          setUser(null);
          setError(null);
          
          // Redirect to home page on sign out
          if (event === 'SIGNED_OUT') {
            router.push('/');
          }
        }
        
        // Important: don't toggle isLoading here during auth state changes
        // This prevents flickering during transitions
      }
    );

    // Call getSession immediately
    getSession();

    // Cleanup
    return () => {
      mounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, [supabase, router]);

  // Sign in function
  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      toast.success('Signed in successfully');
      router.push('/');
    } catch (error) {
      console.error('Sign in error:', error);
      setError(error instanceof Error ? error : new Error('Sign in failed'));
      toast.error(`Failed to sign in: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  };

  // Sign up function
  const signUp = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;
      toast.success('Check your email to confirm your account');
    } catch (error) {
      console.error('Sign up error:', error);
      setError(error instanceof Error ? error : new Error('Sign up failed'));
      toast.error(`Failed to sign up: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  };

  // Sign out function
  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success('Signed out successfully');
    } catch (error) {
      console.error('Sign out error:', error);
      setError(error instanceof Error ? error : new Error('Sign out failed'));
      toast.error(`Failed to sign out: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  };

  // Provide the auth context value
  const value = {
    user,
    session,
    isLoading,
    error,
    signIn,
    signUp,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
