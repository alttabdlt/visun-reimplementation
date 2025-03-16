"use client"

import { useState, useRef, useEffect, KeyboardEvent } from "react"
import { Send, VideoIcon } from "lucide-react"
import { v4 as uuidv4 } from "uuid"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { toast } from "react-hot-toast"

interface ChatInputProps {
  chatId?: string
  userId?: string | null
  onMessageSent?: () => void
  onSendMessage: (content: string, generateAnimation?: boolean) => void
  disabled?: boolean
}

export default function ChatInput({ 
  chatId, 
  userId, 
  onMessageSent, 
  onSendMessage,
  disabled = false
}: ChatInputProps) {
  const [message, setMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [generateAnimation, setGenerateAnimation] = useState(false)
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

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    
    if (!message.trim() || isLoading || disabled) return
    
    try {
      setIsLoading(true)
      const trimmedMessage = message.trim()
      setMessage("")
      
      // If we're using the legacy approach (direct DB interaction in this component)
      if (chatId && userId) {
        // First, update the last message timestamp for the chat
        const { error: updateError } = await supabase
          .from("chat_sessions")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", chatId)
        
        if (updateError) {
          console.error("Failed to update chat session:", updateError)
        }
        
        // Then, insert the user message
        const messageId = uuidv4()
        const { error: messageError } = await supabase
          .from("chat_messages")
          .insert({
            id: messageId,
            session_id: chatId,
            content: trimmedMessage,
            role: "user",
            created_at: new Date().toISOString()
          })
        
        if (messageError) {
          throw messageError
        }
        
        // Optional callback
        if (onMessageSent) {
          onMessageSent()
        }
      } else {
        // Otherwise, use the handler prop
        onSendMessage(trimmedMessage, generateAnimation)
      }
    } catch (error) {
      console.error("Error sending message:", error)
      toast.error("Failed to send message")
    } finally {
      setIsLoading(false)
      // Reset generate animation flag after sending
      setGenerateAnimation(false)
      
      // Restore focus to textarea
      setTimeout(() => {
        textareaRef.current?.focus()
      }, 0)
    }
  }

  return (
    <div className="relative rounded-lg border border-input bg-background shadow-sm">
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="icon"
          className={`h-10 w-10 rounded-full ml-2 ${generateAnimation ? 'bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300' : 'text-muted-foreground hover:text-foreground'}`}
          onClick={() => setGenerateAnimation(!generateAnimation)}
          disabled={disabled || isLoading}
          title={generateAnimation ? "Animation generation enabled" : "Click to enable animation generation"}
        >
          <VideoIcon className="h-5 w-5" />
        </Button>
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="How can Visun help you understand a concept?"
          className="flex-1 resize-none border-0 bg-transparent p-3 placeholder:text-muted-foreground focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-50"
          rows={1}
          disabled={disabled || isLoading}
        />
        <Button
          onClick={handleSubmit}
          disabled={!message.trim() || isLoading || disabled}
          className="mr-2 h-8 w-8"
          variant="ghost"
          size="icon"
        >
          <Send className={`h-4 w-4 ${isLoading ? 'animate-pulse' : ''}`} />
        </Button>
      </div>
    </div>
  )
}
