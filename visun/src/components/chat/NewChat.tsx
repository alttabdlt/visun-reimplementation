import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { PlusCircle, SendIcon, Loader2 } from 'lucide-react';

interface NewChatProps {
  onSendMessage: (message: string) => void;
  onNewChat: () => void;
  isProcessing: boolean;
}

export default function NewChat({ onSendMessage, onNewChat, isProcessing }: NewChatProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize the textarea as content grows
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = '40px'; // Reset height
      const scrollHeight = textarea.scrollHeight;
      textarea.style.height = `${scrollHeight}px`;
    }
  }, [message]);

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isProcessing) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="w-full">
      <div className="flex justify-between mb-2">
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-muted-foreground flex items-center gap-1"
          onClick={onNewChat}
          disabled={isProcessing}
        >
          <PlusCircle className="h-4 w-4" />
          <span>New Chat</span>
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="relative">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message..."
          className="w-full rounded-lg border border-input bg-background px-4 py-2 pr-12 focus:outline-none focus:ring-2 focus:ring-primary resize-none min-h-[40px] max-h-[200px]"
          disabled={isProcessing}
        />
        
        <Button
          type="submit"
          size="icon"
          disabled={!message.trim() || isProcessing}
          className="absolute right-2 bottom-2 h-8 w-8"
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <SendIcon className="h-4 w-4" />
          )}
        </Button>
      </form>
    </div>
  );
}
