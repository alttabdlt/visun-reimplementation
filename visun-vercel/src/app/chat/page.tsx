"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { v4 as uuidv4 } from "uuid"
import { supabase } from "@/lib/supabase"
import ChatInput from "@/components/ChatInput"
// We'll implement the chat components next

export default function ChatPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [messages, setMessages] = useState<any[]>([])
  const [chatId, setChatId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  
  useEffect(() => {
    const initChat = async () => {
      try {
        // Get the current user
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        
        if (userError || !user) {
          router.push("/auth/login")
          return
        }
        
        setUserId(user.id)
        
        // Create a new chat session
        const newChatId = uuidv4()
        const currentTime = new Date().toISOString()
        
        const { error: chatError } = await supabase
          .from("chat_sessions")
          .insert({
            id: newChatId,
            user_id: user.id,
            created_at: currentTime,
            updated_at: currentTime,
            title: "New Chat"
          })
        
        if (chatError) {
          console.error("Failed to create chat session:", chatError)
          return
        }
        
        setChatId(newChatId)
        
        // Add system message
        const systemMessageId = uuidv4()
        const { error: msgError } = await supabase
          .from("chat_messages")
          .insert({
            id: systemMessageId,
            chat_id: newChatId,
            role: "system",
            content: "Welcome to Visun! I'm an AI assistant that can explain concepts with animations. Ask me anything!",
            created_at: currentTime
          })
        
        if (msgError) {
          console.error("Failed to add system message:", msgError)
        }
        
        // Update state
        setMessages([
          {
            id: systemMessageId,
            role: "system",
            content: "Welcome to Visun! I'm an AI assistant that can explain concepts with animations. Ask me anything!",
            created_at: currentTime,
            animation_url: null,
            animation_status: null
          }
        ])
        
        // Redirect to the new chat
        router.push(`/chat/${newChatId}`)
      } catch (error) {
        console.error("Error initializing chat:", error)
      } finally {
        setLoading(false)
      }
    }
    
    initChat()
  }, [router])
  
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-pulse text-2xl text-muted-foreground">Creating new chat...</div>
      </div>
    )
  }
  
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((message) => (
          <div key={message.id} className="mb-4">
            <p className="text-sm font-semibold">
              {message.role === "user" ? "You" : message.role === "assistant" ? "AI" : "System"}
            </p>
            <p className="mt-1">{message.content}</p>
          </div>
        ))}
      </div>
      
      {chatId && (
        <div className="border-t p-4">
          <ChatInput chatId={chatId} userId={userId} onMessageSent={() => {}} />
        </div>
      )}
    </div>
  )
}
