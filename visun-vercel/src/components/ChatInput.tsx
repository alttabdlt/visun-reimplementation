"use client"

import { useState, useRef, useEffect } from "react"
import { Send } from "lucide-react"
import { v4 as uuidv4 } from "uuid"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { toast } from "react-hot-toast"

interface ChatInputProps {
  chatId: string
  userId: string | null
  onMessageSent: () => void
}

export default function ChatInput({ chatId, userId, onMessageSent }: ChatInputProps) {
  const [message, setMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = "0"
      const scrollHeight = textarea.scrollHeight
      textarea.style.height = scrollHeight + "px"
    }
  }, [message])

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    
    if (!message.trim() || isLoading) return
    
    try {
      setIsLoading(true)
      const trimmedMessage = message.trim()
      setMessage("")
      
      // First, update the last message timestamp for the chat
      const { error: updateError } = await supabase
        .from("chat_sessions")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", chatId)
      
      if (updateError) {
        console.error("Failed to update chat session:", updateError)
      }
      
      // Add user message to database
      const userMessageId = uuidv4()
      const { error: userMsgError } = await supabase
        .from("chat_messages")
        .insert({
          id: userMessageId,
          chat_id: chatId,
          role: "user",
          content: trimmedMessage,
          created_at: new Date().toISOString()
        })
      
      if (userMsgError) {
        console.error("Failed to add user message:", userMsgError)
        toast.error("Failed to send message")
        return
      }
      
      // Trigger onMessageSent callback to update UI
      onMessageSent()
      
      // Now call the API for AI response
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chatId,
          message: trimmedMessage,
          userId
        }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to get response")
      }
      
      // The AI message will be stored by the API endpoint
      onMessageSent()
    } catch (error) {
      console.error("Error sending message:", error)
      toast.error("Failed to get response")
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="relative">
      <textarea
        ref={textareaRef}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Send a message..."
        className="w-full resize-none rounded-lg border bg-background px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-primary dark:bg-secondary"
        rows={1}
        disabled={isLoading}
      />
      
      <Button
        type="submit"
        size="icon"
        className="absolute bottom-2 right-2 h-8 w-8 rounded-md"
        disabled={isLoading || !message.trim()}
      >
        <Send className="h-4 w-4" />
      </Button>
    </form>
  )
}
