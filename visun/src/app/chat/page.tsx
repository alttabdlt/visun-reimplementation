"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { v4 as uuidv4 } from 'uuid';
import { useRouter } from 'next/navigation';
import { Header } from "@/components/Header";
import { ChatInput } from "@/components/ChatInput";
import { ChatMessage } from "@/components/ChatMessage";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { saveChatMessage, getChatMessages, createChatSession } from "@/lib/chatUtils";
import { Toaster, toast } from "sonner";
import { User } from '@supabase/supabase-js';

// Sample demo messages for new chats
const initialMessages = [
  {
    id: 1,
    content: "Hello! How can I help you understand complex concepts today?",
    isUser: false,
  }
];

interface Message {
  id: number;
  content: React.ReactNode;
  isUser: boolean;
  keyPoints?: string[];
  animationStatus?: string | null;
  animationData?: Array<{step: number, url: string}> | null;
  messageId?: string;
};

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
      <ChatPageContent />
    </Suspense>
  );
}

function ChatPageContent() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isTyping, setIsTyping] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [hasError, setHasError] = useState(false);
  const router = useRouter();
  const [searchParams, setSearchParams] = useState<Record<string, string>>({});

  useEffect(() => {
    const urlSearchParams = new URLSearchParams(window.location.search);
    const params: Record<string, string> = {};
    
    urlSearchParams.forEach((value, key) => {
      params[key] = value;
    });
    
    setSearchParams(params);
  }, []);

  const sessionParam = searchParams.session;
  const initialQuery = searchParams.initialQuery;
  const generateAnimation = searchParams.generateAnimation === 'true';

  const supabase = createClient();

  // Function to create a new session directly in the database
  const createNewSession = async (firstMessage: string = 'New Chat') => {
    try {
      // Get current user ID if available
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      
      // Generate a new session ID
      const newSessionId = uuidv4();
      
      // Create session in database
      await supabase
        .from('chat_sessions')
        .insert({
          session_id: newSessionId,
          first_message: firstMessage.substring(0, 100),
          user_id: userId || null
        });
      
      console.log('Created new session:', newSessionId);
      return newSessionId;
    } catch (error) {
      console.error('Error creating new session:', error);
      toast.error('Failed to create a new chat session');
      throw error;
    }
  };

  // Simplified function to load messages for a session
  const loadMessages = async (sid: string): Promise<boolean> => {
    try {
      // First verify the session exists
      const { data: sessionData } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('session_id', sid)
        .single();
      
      if (!sessionData) {
        console.log('Session not found, creating it:', sid);
        // Create the session
        await supabase
          .from('chat_sessions')
          .insert({
            session_id: sid,
            first_message: 'Restored session',
            user_id: user?.id || null
          });
      }
      
      // Now get messages
      const existingMessages = await getChatMessages(sid);
      console.log("Retrieved messages:", existingMessages);
      
      if (existingMessages && existingMessages.length > 0) {
        // Convert messages to the format expected by our UI
        const formattedMessages: Message[] = [];
        
        for (const msg of existingMessages) {
          // Add user message
          formattedMessages.push({
            id: formattedMessages.length + 1,
            content: String(msg.user_query || ''),
            isUser: true,
          });
          
          // Now add AI response if available
          if (msg.ai_response !== null) {
            let content: React.ReactNode;
            let keyPoints: string[] = [];
            let animationStatus: string | null = null;
            let animationData: Array<{step: number, url: string}> | null = null;
            
            // Handle different AI response formats
            if (typeof msg.ai_response === 'string') {
              content = msg.ai_response;
            } else if (msg.ai_response && typeof msg.ai_response === 'object') {
              // Extract text/explanation
              if ('explanation' in msg.ai_response && msg.ai_response.explanation) {
                content = String(msg.ai_response.explanation);
              } else if ('text' in msg.ai_response && msg.ai_response.text) {
                content = String(msg.ai_response.text);
              } else {
                content = JSON.stringify(msg.ai_response);
              }
              
              // Extract key points if available
              if ('keyPoints' in msg.ai_response && Array.isArray(msg.ai_response.keyPoints)) {
                keyPoints = msg.ai_response.keyPoints.map(point => String(point));
              }
              
              // Extract animation status
              if ('animationStatus' in msg.ai_response && typeof msg.ai_response.animationStatus === 'string') {
                animationStatus = msg.ai_response.animationStatus;
              }
              
              // Extract animation data
              if ('animationData' in msg.ai_response && Array.isArray(msg.ai_response.animationData)) {
                animationData = msg.ai_response.animationData as Array<{step: number, url: string}>;
              }
            } else {
              content = String(msg.ai_response || '');
            }
            
            formattedMessages.push({
              id: formattedMessages.length + 1,
              content,
              isUser: false,
              keyPoints,
              animationStatus: animationStatus || (typeof msg.animation_status === 'string' ? msg.animation_status : null),
              animationData: animationData || (msg.animation_url ? getAnimationData(String(msg.animation_url)) : null),
              messageId: String(msg.id)
            });
          }
        }
        
        // Set messages at the end
        console.log("Formatted messages:", formattedMessages);
        setMessages(formattedMessages);
        return true;
      } else {
        // No messages found, just use initial welcome message
        console.log("No messages found, using welcome message");
        setMessages(initialMessages);
        return false;
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      toast.error('Failed to load chat history');
      setMessages(initialMessages);
      return false;
    }
  };

  // Initialize chat on component mount
  useEffect(() => {
    const initChat = async () => {
      setIsLoading(true);
      
      try {
        // Check auth status
        const { data: { session } } = await supabase.auth.getSession();
        const currentUser = session?.user || null;
        setUser(currentUser);
        
        // Get URL parameters
        const initialQuery = searchParams.initialQuery;
        const generateAnimation = searchParams.generateAnimation === 'true';
        
        // Check if we have a session parameter
        if (sessionParam) {
          console.log('Using existing session:', sessionParam);
          setSessionId(sessionParam);
          await loadMessages(sessionParam);
          
          // If there's an initial query in the URL, process it
          if (initialQuery) {
            console.log('Processing initial query from URL:', initialQuery);
            setIsTyping(true);
            
            // Adding a slight delay to ensure UI is ready
            setTimeout(async () => {
              try {
                // Call the edge function with the initial query
                const supabase = createClient();
                
                let aiResponseText = "";
                try {
                  console.log("Calling process-query function for initial query...");
                  const { data: functionData, error: functionError } = await supabase.functions.invoke('process-query', {
                    body: {
                      query: initialQuery,
                      sessionId: sessionParam,
                      generateAnimation: generateAnimation
                    }
                  });
                  
                  if (functionError) {
                    console.error('Error calling process-query function for initial query:', functionError);
                    
                    // Handle the case where we couldn't use the function
                    // Save directly to the database with a placeholder
                    await saveChatMessage(
                      sessionParam,
                      initialQuery,
                      {
                        text: "I'm sorry, I encountered an error connecting to the AI service. Please try again later.",
                        keyPoints: [],
                        animationStatus: "disabled",
                        animationData: null
                      }
                    );
                  } else {
                    console.log('Function response for initial query:', functionData);
                    aiResponseText = functionData?.explanation || "Function returned successfully but with no explanation";
                    
                    // If this query was a duplicate and we received an existing flag, don't create a new URL
                    if (functionData?.existing) {
                      console.log('This was an existing chat, not creating a duplicate URL');
                      // Just refresh messages to show the existing message
                      await loadMessages(sessionParam);
                    }
                  }
                } catch (functionCallError) {
                  console.error('Exception when calling Edge Function for initial query:', functionCallError);
                  
                  // Save directly to the database with a placeholder
                  await saveChatMessage(
                    sessionParam,
                    initialQuery,
                    {
                      text: "I'm sorry, I encountered an error connecting to the AI service. Please try again later.",
                      keyPoints: [],
                      animationStatus: "disabled",
                      animationData: null
                    }
                  );
                }
                
                // Reload messages from the database to ensure consistency
                await loadMessages(sessionParam);
              } catch (error) {
                console.error('Error processing initial query:', error);
                
                // Still show something to the user
                setMessages(prev => [
                  ...prev,
                  {
                    id: prev.length + 1,
                    content: "I'm sorry, I encountered an error processing your request. Please try again or sign in if you've been logged out.",
                    isUser: false
                  }
                ]);
              } finally {
                setIsTyping(false);
              }
            }, 500);
          }
        } else if (initialQuery) {
          // If there's an initial query but no session, create a new session first
          try {
            console.log('Checking for existing chat with query:', initialQuery);
            
            // IMPORTANT: First check if we have an existing chat with this exact query
            // Use ilike for case-insensitive matching and trim the query to handle whitespace differences
            const { data: existingChats, error: searchError } = await supabase
              .from('chat_messages')
              .select('session_id, user_query')
              .ilike('user_query', initialQuery.trim()) // Case-insensitive matching
              .order('created_at', { ascending: false })
              .limit(1);
            
            if (searchError) {
              console.error('Error searching for existing chats:', searchError);
            } else if (existingChats && existingChats.length > 0) {
              // Found an existing chat with this query - use that session
              console.log('Found existing chat for query:', existingChats[0]);
              // Ensure we have a string type for the session ID
              const existingSessionId = String(existingChats[0].session_id);
              
              // Update URL without reloading the page and set the session
              // Preserve any other parameters like generateAnimation
              const currentParams = new URLSearchParams(window.location.search);
              currentParams.set('session', existingSessionId);
              
              // Use replace to avoid adding browser history entry
              router.replace(`/chat?${currentParams.toString()}`, { scroll: false });
              
              setSessionId(existingSessionId);
              await loadMessages(existingSessionId);
              return; // Don't continue with creating a new session
            }
            
            // If no existing chat found, create a new session
            console.log('No existing chat found, creating new session for query:', initialQuery);
            const newSessionId = await createNewSession(initialQuery);
            setSessionId(newSessionId);
            
            console.log('Processing initial query with new session:', initialQuery);
            setIsTyping(true);
            
            // Adding a slight delay to ensure UI is ready
            setTimeout(async () => {
              try {
                // Call the edge function with the initial query
                const supabase = createClient();
                
                let aiResponseText = "";
                try {
                  console.log("Calling process-query function for initial query with new session...");
                  const { data: functionData, error: functionError } = await supabase.functions.invoke('process-query', {
                    body: {
                      query: initialQuery,
                      sessionId: newSessionId,
                      generateAnimation: generateAnimation
                    }
                  });
                  
                  if (functionError) {
                    console.error('Error calling process-query function for initial query:', functionError);
                    
                    // Handle the case where we couldn't use the function
                    // Save directly to the database with a placeholder
                    await saveChatMessage(
                      newSessionId,
                      initialQuery,
                      {
                        text: "I'm sorry, I encountered an error connecting to the AI service. Please try again later.",
                        keyPoints: [],
                        animationStatus: "disabled",
                        animationData: null
                      }
                    );
                  } else {
                    console.log('Function response for initial query:', functionData);
                    aiResponseText = functionData?.explanation || "Function returned successfully but with no explanation";
                    
                    // Check if this was a duplicate - if so, redirect to existing chat
                    if (functionData?.existing && functionData?.sessionId) {
                      console.log('Server identified this as a duplicate query. Redirecting to existing chat:', functionData.sessionId);
                      const existingSessionId = String(functionData.sessionId);
                      
                      // Update URL without reloading the page
                      const newUrl = `${window.location.pathname}?session=${existingSessionId}`;
                      router.push(newUrl, { scroll: false });
                      
                      setSessionId(existingSessionId);
                      await loadMessages(existingSessionId);
                      setIsTyping(false);
                      return; // Stop processing here
                    }
                  }
                } catch (functionCallError) {
                  console.error('Exception when calling Edge Function for initial query:', functionCallError);
                  
                  // Save directly to the database with a placeholder
                  await saveChatMessage(
                    newSessionId,
                    initialQuery,
                    {
                      text: "I'm sorry, I encountered an error connecting to the AI service. Please try again later.",
                      keyPoints: [],
                      animationStatus: "disabled",
                      animationData: null
                    }
                  );
                }
                
                // Reload messages from the database to ensure consistency
                await loadMessages(newSessionId);
              } catch (error) {
                console.error('Error processing initial query:', error);
                
                // Still show something to the user
                setMessages(prev => [
                  ...prev,
                  {
                    id: prev.length + 1,
                    content: "I'm sorry, I encountered an error processing your request. Please try again or sign in if you've been logged out.",
                    isUser: false
                  }
                ]);
              } finally {
                setIsTyping(false);
              }
            }, 500);
          } catch (createError) {
            console.error('Error creating new session:', createError);
            // Use a temporary session ID and show welcome message
            setSessionId(uuidv4());
            setMessages(initialMessages);
          }
        } else {
          // Create a new session
          try {
            const newSessionId = await createNewSession();
            console.log('Created new session ID:', newSessionId);
            setSessionId(newSessionId);
            
            // If there's no initial query, just show the welcome message
            if (!initialQuery) {
              console.log('No initial query, showing welcome message');
              setMessages(initialMessages);
            }
            
            // Update URL to include session ID (but preserve other parameters)
            const currentParams = new URLSearchParams(window.location.search);
            currentParams.set('session', newSessionId);
            
            // Use replace to avoid adding to browser history
            router.replace(`/chat?${currentParams.toString()}`);
            
            // If we have an initial query from URL parameters, process it
            if (initialQuery) {
              console.log('Processing initial query from URL:', initialQuery);
              
              // First update the UI with the user's message
              setMessages([
                ...initialMessages,
                {
                  id: initialMessages.length + 1,
                  content: initialQuery,
                  isUser: true
                }
              ]);
              
              // Show typing indicator
              setIsTyping(true);
              
              // Short timeout to ensure the session is fully set up
              setTimeout(async () => {
                try {
                  // Add a fallback if the Edge Function fails
                  let aiResponseText = "";
                  try {
                    // Call the Supabase Edge Function to process the query
                    const supabase = createClient();
                    
                    // First check if we have a valid session
                    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
                    
                    console.log("Checking auth before calling process-query function for initial query...");
                    
                    console.log("Calling process-query function for initial query...");
                    const { data: functionData, error: functionError } = await supabase.functions.invoke('process-query', {
                      body: {
                        query: initialQuery,
                        sessionId: newSessionId,
                        generateAnimation: generateAnimation
                      }
                    });
                    
                    if (functionError) {
                      console.error('Error calling process-query function for initial query:', functionError);
                      
                      // Handle the case where we couldn't use the function
                      // Save directly to the database with a placeholder
                      await saveChatMessage(
                        newSessionId,
                        initialQuery,
                        {
                          text: "I'm sorry, I encountered an error connecting to the AI service. Please try again later.",
                          keyPoints: [],
                          animationStatus: "disabled",
                          animationData: null
                        }
                      );
                    } else {
                      console.log('Function response for initial query:', functionData);
                      aiResponseText = functionData?.explanation || "Function returned successfully but with no explanation";
                    }
                  } catch (functionCallError) {
                    console.error('Exception when calling Edge Function for initial query:', functionCallError);
                    
                    // Save directly to the database with a placeholder
                    await saveChatMessage(
                      newSessionId,
                      initialQuery,
                      {
                        text: "I'm sorry, I encountered an error connecting to the AI service. Please try again later.",
                        keyPoints: [],
                        animationStatus: "disabled",
                        animationData: null
                      }
                    );
                  }
                  
                  // Reload messages from the database to ensure consistency
                  await loadMessages(newSessionId);
                } catch (error) {
                  console.error('Error processing initial query:', error);
                  
                  // Still show something to the user
                  setMessages(prev => [
                    ...prev,
                    {
                      id: prev.length + 1,
                      content: "I'm sorry, I encountered an error processing your request. Please try again or sign in if you've been logged out.",
                      isUser: false
                    }
                  ]);
                } finally {
                  setIsTyping(false);
                }
              }, 500);
            }
          } catch (createError) {
            console.error('Error creating new session:', createError);
            // Use a temporary session ID and show welcome message
            setSessionId(uuidv4());
            setMessages(initialMessages);
          }
        }
      } catch (error) {
        console.error('Error initializing chat:', error);
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    };
    
    initChat();
  }, [sessionParam, searchParams]);

  // Handle sending a new message
  const handleSendMessage = async (message: string, generateAnimation: boolean = false) => {
    if (!message.trim() || !sessionId) return;
    
    try {
      console.log('Sending message:', message, 'to session:', sessionId);
      // Add user message to UI immediately
      const msgId = messages.length + 1;
      setMessages(prev => [...prev, { id: msgId, content: message, isUser: true }]);
      
      // Show typing indicator
      setIsTyping(true);
      
      // Add a fallback if the Edge Function fails
      let aiResponseText = "";
      try {
        // Call the Supabase Edge Function to process the query
        const supabase = createClient();
        
        // First check if we have a valid session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        // Use the database directly if the function call fails
        console.log("Checking auth before calling process-query function...");
        
        console.log("Calling process-query function...");
        const { data: functionData, error: functionError } = await supabase.functions.invoke('process-query', {
          body: {
            query: message,
            sessionId: sessionId,
            generateAnimation: generateAnimation
          }
        });
        
        if (functionError) {
          console.error('Error calling process-query function:', functionError);
          
          // Handle the case where we couldn't use the function
          // Save directly to the database with a placeholder
          await saveChatMessage(
            sessionId, 
            message, 
            {
              text: "I'm sorry, I encountered an error connecting to the AI service. Please try again later.",
              keyPoints: [],
              animationStatus: "disabled",
              animationData: null
            }
          );
        } else {
          console.log('Function response:', functionData);
          aiResponseText = functionData?.explanation || "Function returned successfully but with no explanation";
        }
      } catch (functionCallError) {
        console.error('Exception when calling Edge Function:', functionCallError);
        
        // Save directly to the database with a placeholder
        await saveChatMessage(
          sessionId, 
          message, 
          {
            text: "I'm sorry, I encountered an error connecting to the AI service. Please try again later.",
            keyPoints: [],
            animationStatus: "disabled",
            animationData: null
          }
        );
      }
      
      // Get updated messages AFTER processing
      const updatedMessages = await getChatMessages(sessionId);
      console.log('Updated messages after send:', updatedMessages);
      
      if (updatedMessages && updatedMessages.length > 0) {
        // Format messages for UI
        const formattedMessages: Message[] = [];
        
        for (const msg of updatedMessages) {
          // Add user message
          formattedMessages.push({
            id: formattedMessages.length + 1,
            content: String(msg.user_query || ''),
            isUser: true,
          });
          
          // Add AI response if available
          if (msg.ai_response !== null) {
            let content: React.ReactNode;
            let keyPoints: string[] = [];
            let animationStatus: string | null = null;
            let animationData: Array<{step: number, url: string}> | null = null;
            
            // Handle different AI response formats
            if (typeof msg.ai_response === 'string') {
              content = msg.ai_response;
            } else if (msg.ai_response && typeof msg.ai_response === 'object') {
              // Extract text/explanation
              if ('explanation' in msg.ai_response && msg.ai_response.explanation) {
                content = String(msg.ai_response.explanation);
              } else if ('text' in msg.ai_response && msg.ai_response.text) {
                content = String(msg.ai_response.text);
              } else {
                content = JSON.stringify(msg.ai_response);
              }
              
              // Extract key points if available
              if ('keyPoints' in msg.ai_response && Array.isArray(msg.ai_response.keyPoints)) {
                keyPoints = msg.ai_response.keyPoints.map(point => String(point));
              }
              
              // Extract animation status
              if ('animationStatus' in msg.ai_response && typeof msg.ai_response.animationStatus === 'string') {
                animationStatus = msg.ai_response.animationStatus;
              }
              
              // Extract animation data
              if ('animationData' in msg.ai_response && Array.isArray(msg.ai_response.animationData)) {
                animationData = msg.ai_response.animationData as Array<{step: number, url: string}>;
              }
            } else {
              content = String(msg.ai_response || '');
            }
            
            formattedMessages.push({
              id: formattedMessages.length + 1,
              content,
              isUser: false,
              keyPoints,
              animationStatus: animationStatus || (typeof msg.animation_status === 'string' ? msg.animation_status : null),
              animationData: animationData || (msg.animation_url ? getAnimationData(String(msg.animation_url)) : null),
              messageId: String(msg.id)
            });
          }
        }
        
        console.log('Formatted messages after send:', formattedMessages);
        setMessages(formattedMessages);
      }
      
      setIsTyping(false);
    } catch (error) {
      console.error('Error in handleSendMessage:', error);
      
      // Add error message
      setMessages(prev => [
        ...prev, 
        { 
          id: prev.length + 1, 
          content: "I'm sorry, I encountered an error processing your request. Please try again or sign in if you've been logged out.", 
          isUser: false 
        }
      ]);
      
      setIsTyping(false);
    }
  };

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Helper function to extract animation URLs from various formats
  const getAnimationData = (animationUrl: string | Array<{step: number, url: string}> | null): Array<{step: number, url: string}> | null => {
    if (!animationUrl) return null;
    
    // Placeholder animation URL
    const placeholderUrl = "https://xavafuqrqucwbjxxcgqk.supabase.co/storage/v1/object/public/animations/placeholder-animation.mp4";
    
    try {
      // If it's an array of animations with steps
      if (Array.isArray(animationUrl)) {
        // Validate each item in the array
        return animationUrl
          .filter(item => item && typeof item === 'object')
          .map(item => {
            // Use type assertion to help TypeScript understand the shape
            const animItem = item as {step?: number, url?: string};
            return {
              step: typeof animItem.step === 'number' ? animItem.step : 0,
              url: typeof animItem.url === 'string' ? animItem.url : placeholderUrl
            };
          })
          .sort((a, b) => a.step - b.step);
      }
      
      // If it's a single animation object
      if (typeof animationUrl === 'object' && animationUrl !== null && 'url' in animationUrl) {
        // Use type assertion to help TypeScript understand the shape
        const animObj = animationUrl as {step?: number, url?: string};
        const url = typeof animObj.url === 'string' ? animObj.url : placeholderUrl;
        return [{
          step: typeof animObj.step === 'number' ? animObj.step : 0,
          url: url
        }];
      }
      
      // If it's a string
      if (typeof animationUrl === 'string') {
        // Validate that it's a proper URL
        try {
          // Just check if it's a valid URL format
          new URL(animationUrl);
          return [{
            step: 0,
            url: animationUrl
          }];
        } catch (e) {
          console.warn('Invalid URL string:', animationUrl);
          return [{
            step: 0,
            url: placeholderUrl
          }];
        }
      }
      
      // Default fallback
      console.warn('Using placeholder for unprocessable animation data:', animationUrl);
      return [{
        step: 0,
        url: placeholderUrl
      }];
    } catch (error) {
      console.error('Error processing animation data:', error, animationUrl);
      return [{
        step: 0,
        url: placeholderUrl
      }];
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Loading chat...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (hasError) {
    return (
      <div className="flex flex-col min-h-screen pb-40">
        <Header />
        <div className="flex flex-col h-full max-w-4xl mx-auto p-4">
          <div className="p-4 border border-red-300 rounded bg-red-50">
            <h2 className="text-lg font-medium text-red-800">Something went wrong</h2>
            <p className="mt-2 text-red-700">
              There was an error processing your request. Please refresh the page and try again.
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="mt-3 px-4 py-2 bg-red-100 text-red-800 rounded hover:bg-red-200"
            >
              Refresh Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen pb-40">
      <Toaster position="top-center" />
      <Header />

      <main className="flex-1">
        {messages.map((message) => (
          <ChatMessage
            key={message.id}
            content={message.content}
            isUser={message.isUser}
            keyPoints={message.keyPoints}
            animationStatus={message.animationStatus}
            animationData={message.animationData}
            messageId={message.messageId ? Number(message.messageId) : undefined}
          />
        ))}
        
        {isTyping && (
          <div className="w-full py-8">
            <div className="container max-w-3xl mx-auto px-4">
              <div className="flex gap-4">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                  V
                </div>
                <div className="flex items-center text-muted-foreground">
                  <span className="animate-pulse">Thinking...</span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </main>

      <ChatInput onSendMessage={handleSendMessage} disabled={isTyping} />
    </div>
  );
}
