"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { Plus, Trash2 } from "lucide-react"
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
  userId: string | undefined
}

export default function ChatSidebar({ userId }: ChatSidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([])
  const [loading, setLoading] = useState(true)
  
  // Get the current chat ID from the URL
  const currentChatId = pathname?.startsWith('/chat/') 
    ? pathname.split('/').pop() 
    : null
  
  useEffect(() => {
    if (!userId) return
    
    const fetchChatSessions = async () => {
      try {
        const { data, error } = await supabase
          .from("chat_sessions")
          .select("id, title, updated_at")
          .eq("user_id", userId)
          .order("updated_at", { ascending: false })
        
        if (error) {
          throw error
        }
        
        setChatSessions(data)
      } catch (error) {
        console.error("Error fetching chat sessions:", error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchChatSessions()
    
    // Subscribe to changes
    const channel = supabase
      .channel("chat_sessions_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_sessions",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchChatSessions()
        }
      )
      .subscribe()
    
    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])
  
  const createNewChat = async () => {
    router.push("/chat")
  }
  
  const deleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    try {
      // Delete all messages first (foreign key constraint)
      const { error: messagesError } = await supabase
        .from("chat_messages")
        .delete()
        .eq("chat_id", chatId)
      
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
      
      toast.success("Chat deleted successfully")
      
      // If we're deleting the current chat, redirect to /chat
      if (currentChatId === chatId) {
        router.push("/chat")
      }
    } catch (error) {
      console.error("Error deleting chat:", error)
      toast.error("Failed to delete chat")
    }
  }
  
  return (
    <aside className="h-full w-64 bg-card">
      <div className="flex h-full flex-col">
        <div className="p-4">
          <Button 
            className="w-full justify-start" 
            onClick={createNewChat}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Chat
          </Button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="text-center text-sm text-muted-foreground">
              Loading chats...
            </div>
          ) : chatSessions.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground">
              No chats yet. Create one to get started!
            </div>
          ) : (
            <ul className="space-y-1">
              {chatSessions.map((chat) => (
                <li key={chat.id}>
                  <Link
                    href={`/chat/${chat.id}`}
                    className={`flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-accent ${
                      currentChatId === chat.id ? "bg-accent" : ""
                    }`}
                  >
                    <div className="flex-1 truncate">
                      <div className="font-medium">
                        {truncateText(chat.title || "New Chat", 20)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(new Date(chat.updated_at))}
                      </div>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-60 hover:opacity-100"
                      onClick={(e) => deleteChat(chat.id, e)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </aside>
  )
}
