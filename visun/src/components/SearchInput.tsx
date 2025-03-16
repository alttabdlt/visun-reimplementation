"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Paperclip, ArrowUp, Video } from "lucide-react";
import { useState, KeyboardEvent } from "react";

interface SearchInputProps {
  onSendMessage: (message: string, generateAnimation?: boolean) => void;
}

export function SearchInput({ onSendMessage }: SearchInputProps) {
  const [query, setQuery] = useState("");
  const [generateAnimation, setGenerateAnimation] = useState(false);

  const handleSubmit = () => {
    if (query.trim()) {
      onSendMessage(query, generateAnimation);
      setQuery("");
      setGenerateAnimation(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="relative w-full mt-8">
      <div className="rounded-full border border-input bg-background dark:bg-[hsl(215,25%,22%)] shadow-sm overflow-hidden">
        <div className="flex items-center px-4">
          <Button
            variant="ghost"
            size="icon"
            className={`h-10 w-10 rounded-full mr-2 ${generateAnimation ? 'bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setGenerateAnimation(!generateAnimation)}
            title={generateAnimation ? "Animation generation enabled" : "Click to enable animation generation"}
          >
            <Video className="h-5 w-5" />
          </Button>
          <Input
            type="text"
            placeholder="What do you want to know?"
            className="flex-1 border-0 bg-transparent py-6 focus-visible:ring-0 focus-visible:ring-offset-0 text-base dark:text-foreground dark:placeholder:text-[hsl(210,40%,75%)]"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <Button
            onClick={handleSubmit}
            disabled={!query.trim()}
            className="h-10 w-10 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 ml-2"
          >
            <ArrowUp className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
