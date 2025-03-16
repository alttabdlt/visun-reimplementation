"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Play, Pause, AlertCircle } from "lucide-react"
import { formatDate } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import CodeBlock from "@/components/CodeBlock"

interface ChatMessageProps {
  message: {
    id: string
    role: string
    content: string
    created_at: string
    animation_url: string | null
    animation_status: string | null
    animation_error: string | null
  }
  isUser?: boolean
}

export default function ChatMessage({ message, isUser }: ChatMessageProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [animationStatus, setAnimationStatus] = useState(message.animation_status)
  const [animationUrl, setAnimationUrl] = useState(message.animation_url)
  const [error, setError] = useState(message.animation_error)
  const [isPolling, setIsPolling] = useState(false)
  
  // Format the message content
  const formattedContent = formatMessageContent(message.content)
  
  // Check if this is an assistant message that might have an animation
  const canHaveAnimation = message.role === "assistant" && message.content.length > 50
  
  // Poll for animation status if it's processing
  useEffect(() => {
    if (
      canHaveAnimation && 
      animationStatus === "processing" && 
      !isPolling && 
      !animationUrl
    ) {
      const pollInterval = setInterval(async () => {
        try {
          const response = await fetch(`/api/animation-status/${message.id}`)
          const data = await response.json()
          
          if (data.success) {
            setAnimationStatus(data.status)
            
            if (data.status === "completed" && data.url) {
              setAnimationUrl(data.url)
              clearInterval(pollInterval)
              setIsPolling(false)
            } else if (data.status === "error") {
              setError(data.error)
              clearInterval(pollInterval)
              setIsPolling(false)
            }
          }
        } catch (error) {
          console.error("Error polling animation status:", error)
        }
      }, 3000)
      
      setIsPolling(true)
      
      return () => {
        clearInterval(pollInterval)
        setIsPolling(false)
      }
    }
  }, [message.id, animationStatus, animationUrl, canHaveAnimation, isPolling])
  
  const handleTogglePlay = () => {
    setIsPlaying(!isPlaying)
  }
  
  // Determine if we should render the animation controls
  const showAnimationControls = canHaveAnimation && (
    animationStatus === "processing" || 
    animationStatus === "completed" || 
    animationStatus === "error"
  )
  
  return (
    <div className={`mb-6 ${message.role === "user" ? "ml-auto max-w-3xl" : "mr-auto max-w-3xl"}`}>
      <div className="mb-1 flex items-center">
        <span className="text-sm font-semibold">
          {message.role === "user" ? "You" : message.role === "assistant" ? "AI" : "System"}
        </span>
        <span className="ml-2 text-xs text-muted-foreground">
          {formatDate(new Date(message.created_at))}
        </span>
      </div>
      
      <div className="rounded-lg border bg-card p-4 shadow-sm">
        <div className="prose dark:prose-invert max-w-none">
          {formattedContent}
        </div>
        
        {showAnimationControls && (
          <div className="mt-4">
            <div className="rounded-lg border bg-background p-4">
              <h4 className="mb-2 text-sm font-medium">Visual Explanation</h4>
              
              {animationStatus === "processing" && (
                <div className="flex items-center text-sm text-muted-foreground">
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                  Generating animation...
                </div>
              )}
              
              {animationStatus === "error" && (
                <div className="flex items-center text-sm text-destructive">
                  <AlertCircle className="mr-2 h-4 w-4" />
                  {error || "Failed to generate animation"}
                </div>
              )}
              
              {animationStatus === "completed" && animationUrl && (
                <div>
                  <div className="relative aspect-video overflow-hidden rounded">
                    <video
                      src={animationUrl}
                      className="h-full w-full"
                      autoPlay={isPlaying}
                      loop
                      muted
                      playsInline
                    />
                    
                    {!isPlaying && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <Button
                          variant="default"
                          size="sm"
                          className="rounded-full"
                          onClick={handleTogglePlay}
                        >
                          <Play className="h-4 w-4" />
                          <span className="ml-1">Play</span>
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  {isPlaying && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={handleTogglePlay}
                    >
                      <Pause className="mr-1 h-3 w-3" />
                      Pause
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Helper function to format message content with code blocks
function formatMessageContent(content: string) {
  if (!content) return null
  
  // Split the content by code blocks
  const parts = content.split(/(```[\s\S]*?```)/g)
  
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("```") && part.endsWith("```")) {
          // Extract language and code
          const match = part.match(/```([\w-]+)?\n([\s\S]*?)```/)
          
          if (match) {
            const language = match[1] || "text"
            const code = match[2]
            
            return <CodeBlock key={index} language={language} code={code} />
          }
          
          // If no match, just return the raw part
          return <pre key={index}>{part.slice(3, -3)}</pre>
        }
        
        // Regular text - render as is with line breaks preserved
        return (
          <div key={index} dangerouslySetInnerHTML={{ __html: part.replace(/\n/g, "<br />") }} />
        )
      })}
    </>
  )
}
