"use client";

import { useState, KeyboardEvent } from "react";
import { ArrowUpIcon, VideoIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ChatInputProps {
  onSendMessage: (message: string, generateAnimation?: boolean) => void;
  disabled?: boolean;
}

export function ChatInput({ onSendMessage, disabled = false }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [generateAnimation, setGenerateAnimation] = useState(false);

  const handleSubmit = () => {
    if (message.trim()) {
      onSendMessage(message, generateAnimation);
      setMessage("");
      setGenerateAnimation(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-sm border-t border-border">
      <div className="container max-w-3xl mx-auto px-4 py-4">
        <div className="relative rounded-lg border border-input bg-background shadow-sm chat-input">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              className={`h-10 w-10 rounded-full ml-2 ${generateAnimation ? 'bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setGenerateAnimation(!generateAnimation)}
              disabled={disabled}
              title={generateAnimation ? "Animation generation enabled" : "Click to enable animation generation"}
            >
              <VideoIcon className="h-5 w-5" />
            </Button>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="How can Visun help?"
              rows={1}
              disabled={disabled}
              className="flex-1 resize-none border-0 bg-transparent p-4 focus-visible:ring-0 focus-visible:ring-offset-0 text-base dark:text-foreground"
            />
            <Button
              type="submit"
              size="icon"
              className="h-10 w-10 rounded-full mr-2"
              onClick={handleSubmit}
              disabled={!message.trim() || disabled}
            >
              <ArrowUpIcon className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
