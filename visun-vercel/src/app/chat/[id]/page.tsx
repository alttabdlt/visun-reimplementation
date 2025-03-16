"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { useParams } from "@/lib/use-params"
import ChatInput from "@/components/ChatInput"
import ChatMessage from "@/components/ChatMessage"
import Header from "@/components/Header"
import { toast } from "react-hot-toast"

interface PageProps {
  params: {
    id: string
  }
}

export default function ChatPage({ params }: PageProps) {
  // Use our custom hook to safely unwrap params
  const { id: chatId } = useParams(params)
  const [userId, setUserId] = useState<string | null>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [chatTitle, setChatTitle] = useState("Chat")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    const checkSession = async () => {
      const { data, error } = await supabase.auth.getUser()
      
      if (error || !data.user) {
        router.push("/auth/login")
        return null
      }
      
      return data.user.id
    }
    
    const fetchMessages = async () => {
      try {
        const userId = await checkSession()
        if (!userId) return
        
        setUserId(userId)
        
        // Get chat details
        const { data: chatData, error: chatError } = await supabase
          .from("chat_sessions")
          .select("title, user_id")
          .eq("id", chatId)
          .single()
        
        if (chatError) {
          console.error("Error fetching chat:", chatError)
          toast.error("Failed to load chat")
          router.push("/chat")
          return
        }
        
        // Check if user has access to this chat
        if (chatData.user_id !== userId) {
          toast.error("You don't have access to this chat")
          router.push("/chat")
          return
        }
        
        setChatTitle(chatData.title || "Chat")
        
        // Get messages
        const { data: messagesData, error: messagesError } = await supabase
          .from("chat_messages")
          .select("*")
          .eq("session_id", chatId)
          .order("created_at", { ascending: true })
        
        if (messagesError) {
          console.error("Error fetching messages:", messagesError)
          toast.error("Failed to load messages")
          return
        }
        
        setMessages(messagesData || [])
      } catch (error) {
        console.error("Error in chat page:", error)
        toast.error("An error occurred")
      } finally {
        setLoading(false)
      }
    }
    
    fetchMessages()
    
    // Subscribe to new messages
    const channel = supabase
      .channel(`chat:${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_messages",
          filter: `session_id=eq.${chatId}`,
        },
        (payload) => {
          // Handle different events
          if (payload.eventType === "INSERT") {
            setMessages((prev) => [...prev, payload.new])
          } else if (payload.eventType === "UPDATE") {
            setMessages((prev) =>
              prev.map((msg) => (msg.id === payload.new.id ? payload.new : msg))
            )
          } else if (payload.eventType === "DELETE") {
            setMessages((prev) => prev.filter((msg) => msg.id !== payload.old.id))
          }
        }
      )
      .subscribe()
    
    return () => {
      supabase.removeChannel(channel)
    }
  }, [chatId, router])

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSendMessage = async (content: string, generateAnimation = false) => {
    if (!userId || !content.trim()) return
    
    try {
      const { error } = await supabase
        .from("chat_messages")
        .insert({
          session_id: chatId,
          content,
          role: "user"
        })
      
      if (error) throw error
      
      // Send to API for AI response
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_id: chatId,
          message: content,
          generate_animation: generateAnimation
        }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to get AI response")
      }
    } catch (error) {
      console.error("Error sending message:", error)
      toast.error("Failed to send message")
    }
  }

  return (
    <div className="flex flex-col h-screen">
      <Header />
      
      <div className="flex-1 flex flex-col overflow-hidden max-w-4xl mx-auto w-full px-4">
        <div className="p-4 border-b">
          <h1 className="text-2xl font-bold">{chatTitle}</h1>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-pulse text-lg text-muted-foreground">Loading messages...</div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-center">
              <div>
                <h2 className="text-2xl mb-2">Start a new conversation</h2>
                <p className="text-gray-500 dark:text-gray-400">
                  Send a message to begin your visual learning journey
                </p>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                isUser={message.role === "user"}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
        
        <div className="p-4 border-t">
          <ChatInput
            onSendMessage={handleSendMessage}
            disabled={loading}
          />
        </div>
      </div>
    </div>
  )
}
