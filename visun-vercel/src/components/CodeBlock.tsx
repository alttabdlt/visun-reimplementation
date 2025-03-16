"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"

interface CodeBlockProps {
  language: string
  code: string
}

export default function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error("Failed to copy code", error)
    }
  }
  
  return (
    <div className="my-4 overflow-hidden rounded-md border bg-secondary">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <span className="text-xs font-medium">
          {language}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1"
          onClick={handleCopy}
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              <span className="text-xs">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span className="text-xs">Copy</span>
            </>
          )}
        </Button>
      </div>
      <pre className="overflow-x-auto p-4">
        <code>{code}</code>
      </pre>
    </div>
  )
}
