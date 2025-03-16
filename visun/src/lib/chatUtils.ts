import { v4 as uuidv4 } from 'uuid';
import { createClient } from './supabase/client';

/**
 * Creates a new chat session in the database
 * @param firstMessage The first message of the chat session
 * @param userId Optional user ID to associate with the chat session
 * @returns The session ID for the new chat
 */
export async function createChatSession(firstMessage: string, userId?: string): Promise<string> {
  const sessionId = uuidv4();
  const supabase = createClient();
  
  try {
    // Get current user session if userId is not provided
    if (!userId) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        userId = session.user.id;
      }
    }
    
    const { error } = await supabase
      .from('chat_sessions')
      .insert({
        session_id: sessionId,
        first_message: firstMessage.substring(0, 100), // Limit to 100 chars for preview
        user_id: userId || null // Explicitly set to null for guest sessions
      });
    
    if (error) {
      console.error('Error creating chat session:', error);
      throw error;
    }
    
    console.log(`Created new chat session: ${sessionId} for user: ${userId || 'guest'}`);
    return sessionId;
  } catch (error) {
    console.error('Error creating chat session:', error);
    throw error;
  }
}

/**
 * Saves a chat message to the database
 * @param sessionId The session ID for the chat
 * @param userQuery The user's message
 * @param aiResponse The AI's response
 */
export async function saveChatMessage(
  sessionId: string, 
  userQuery: string, 
  aiResponse: string | {
    explanation?: string;
    text?: string;
    keyPoints?: string[];
    animationStatus?: string;
    animationData?: Array<{step: number, url: string}> | null;
    chunks?: Array<{
      content: string;
      type: string;
      step: number;
    }>;
    animation?: {
      type: string;
      style: string;
    };
  }
): Promise<void> {
  if (!sessionId) {
    console.error('No session ID provided for saving chat message');
    throw new Error('Session ID is required');
  }
  
  const supabase = createClient();
  
  try {
    // Save the message directly - our RLS allows this
    const { error } = await supabase
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        user_query: userQuery,
        ai_response: aiResponse,
      });
    
    if (error) {
      // Check if the error is related to the session not existing
      if (error.message && error.message.includes('foreign key constraint')) {
        // Try to create the session first
        console.log('Creating session for message:', sessionId);
        
        // Get current user ID if available
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        
        // Create the session
        await supabase
          .from('chat_sessions')
          .insert({
            session_id: sessionId,
            first_message: userQuery.substring(0, 100),
            user_id: userId || null
          });
          
        // Try saving the message again
        const { error: retryError } = await supabase
          .from('chat_messages')
          .insert({
            session_id: sessionId,
            user_query: userQuery,
            ai_response: aiResponse,
          });
          
        if (retryError) {
          console.error('Error saving chat message after creating session:', retryError);
          throw retryError;
        }
      } else {
        console.error('Error saving chat message:', error);
        throw error;
      }
    }
    
    console.log(`Saved chat message to session ${sessionId}`);
  } catch (error) {
    console.error('Error in saveChatMessage:', error);
    throw error;
  }
}

/**
 * Get all messages for a specific chat session - with improved error handling
 */
export async function getChatMessages(sessionId: string) {
  if (!sessionId) {
    console.error('No session ID provided to getChatMessages');
    return [];
  }

  const supabase = createClient();

  try {
    // First check if the session exists in the database
    const { data: sessionExists, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('session_id')
      .eq('session_id', sessionId)
      .maybeSingle();
      
    if (sessionError || !sessionExists) {
      console.warn('Session does not exist in chat_sessions table:', sessionId);
      
      // Try to create it automatically
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        // Create the session
        await supabase
          .from('chat_sessions')
          .insert({
            session_id: sessionId,
            first_message: 'Created automatically',
            user_id: session?.user?.id || null
          });
          
        console.log('Auto-created missing session:', sessionId);
      } catch (createError) {
        console.error('Could not auto-create session:', createError);
      }
      
      // Return empty array since there can't be messages for this session yet
      return [];
    }

    // Try to get messages now that we know the session exists
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });
    
    if (error) {
      console.error('Error fetching chat messages:', error);
      return [];
    }
    
    if (!data || data.length === 0) {
      console.log(`No messages found for session ID: ${sessionId}`);
      return [];
    }
    
    console.log(`Retrieved ${data.length} messages for session ${sessionId}`);
    return data;
  } catch (error) {
    console.error('Unexpected error fetching chat messages:', error);
    return [];
  }
}
