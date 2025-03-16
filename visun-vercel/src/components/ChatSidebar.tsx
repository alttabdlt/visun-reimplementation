"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { Plus, Trash2, X } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { formatDate, truncateText } from "@/lib/utils"
import { toast } from "react-hot-toast"

interface ChatSession {
  id: string
  title: string
  updated_at: string
}

interface ChatSidebarProps {
  open: boolean
  onClose: () => void
}

export default function ChatSidebar({ open, onClose }: ChatSidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  
  // Get the current chat ID from the URL
  const currentChatId = pathname?.startsWith('/chat/') 
    ? pathname.split('/').pop() 
    : null
  
  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser()
      if (data?.user) {
        setUser(data.user)
        fetchChatSessions(data.user.id)
      }
    }
    
    getUser()
    
    // Setup realtime subscription for chat sessions
    const chatChannel = supabase
      .channel('chat_updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_sessions',
      }, () => {
        if (user?.id) fetchChatSessions(user.id)
      })
      .subscribe()
    
    return () => {
      supabase.removeChannel(chatChannel)
    }
  }, [])
  
  const fetchChatSessions = async (userId: string) => {
    if (!userId) return
    
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from("chat_sessions")
        .select("id, title, updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
      
      if (error) {
        throw error
      }
      
      setChatSessions(data || [])
    } catch (error) {
      console.error("Error fetching chat sessions:", error)
      toast.error("Failed to load chat history")
    } finally {
      setLoading(false)
    }
  }
  
  const handleNewChat = async () => {
    try {
      if (!user?.id) {
        toast.error("You must be logged in to create a chat")
        return
      }
      
      // Create a new chat session
      const { data, error } = await supabase
        .from("chat_sessions")
        .insert({
          user_id: user.id,
          title: "New Chat",
        })
        .select()
      
      if (error) {
        throw error
      }
      
      if (data && data[0]) {
        // Navigate to the new chat
        router.push(`/chat/${data[0].id}`)
        onClose()
      }
    } catch (error) {
      console.error("Error creating new chat:", error)
      toast.error("Failed to create new chat")
    }
  }
  
  const handleDeleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    try {
      // First delete all messages
      const { error: messagesError } = await supabase
        .from("chat_messages")
        .delete()
        .eq("session_id", chatId)
      
      if (messagesError) {
        throw messagesError
      }
      
      // Then delete the chat session
      const { error: sessionError } = await supabase
        .from("chat_sessions")
        .delete()
        .eq("id", chatId)
      
      if (sessionError) {
        throw sessionError
      }
      
      // Update the UI
      setChatSessions(chatSessions.filter(chat => chat.id !== chatId))
      
      // If we deleted the current chat, redirect to home
      if (currentChatId === chatId) {
        router.push("/")
      }
      
      toast.success("Chat deleted successfully")
    } catch (error) {
      console.error("Error deleting chat:", error)
      toast.error("Failed to delete chat")
    }
  }
  
  if (!open) return null
  
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative flex w-full max-w-xs flex-1 flex-col bg-background shadow-lg">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-medium">Your Chats</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-auto p-3">
          <Button
            onClick={handleNewChat}
            className="w-full mb-3 flex items-center justify-center gap-2"
            disabled={loading}
          >
            <Plus className="h-4 w-4" />
            <span>New Chat</span>
          </Button>
          
          {loading ? (
            <div className="flex justify-center p-4">
              <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-foreground" />
            </div>
          ) : chatSessions.length > 0 ? (
            <div className="space-y-2">
              {chatSessions.map((chat) => (
                <Link
                  key={chat.id}
                  href={`/chat/${chat.id}`}
                  className={`block p-3 rounded-lg transition ${
                    currentChatId === chat.id
                      ? "bg-primary-foreground"
                      : "hover:bg-accent"
                  }`}
                  onClick={() => onClose()}
                >
                  <div className="flex justify-between items-start">
                    <h3 className="font-medium">
                      {truncateText(chat.title || "New Chat", 25)}
                    </h3>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100"
                      onClick={(e) => handleDeleteChat(chat.id, e)}
                      title="Delete chat"
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDate(chat.updated_at)}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center p-4 text-muted-foreground">
              No chat history found
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
