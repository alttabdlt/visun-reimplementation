"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import ChatInput from "@/components/ChatInput"
import ChatMessage from "@/components/ChatMessage"
import { toast } from "react-hot-toast"

interface PageProps {
  params: {
    id: string
  }
}

export default function ChatPage({ params }: PageProps) {
  const chatId = params.id
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
          .eq("chat_id", chatId)
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
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setMessages((prevMessages) => [
              ...prevMessages,
              payload.new,
            ])
          } else if (payload.eventType === "UPDATE") {
            setMessages((prevMessages) =>
              prevMessages.map((msg) =>
                msg.id === payload.new.id ? payload.new : msg
              )
            )
          }
        }
      )
      .subscribe()
    
    return () => {
      supabase.removeChannel(channel)
    }
  }, [chatId, router])
  
  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])
  
  const handleMessageSent = () => {
    // This will trigger a refresh from the subscription
  }
  
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-pulse text-2xl text-muted-foreground">Loading chat...</div>
      </div>
    )
  }
  
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center text-muted-foreground">
              <p className="text-lg">No messages yet</p>
              <p className="text-sm">Start the conversation below</p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <ChatMessage 
              key={message.id}
              message={message}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="border-t p-4">
        <ChatInput 
          chatId={chatId} 
          userId={userId} 
          onMessageSent={handleMessageSent} 
        />
      </div>
    </div>
  )
}
