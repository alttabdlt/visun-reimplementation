import React from 'react';

interface ChatMessageProps {
  userMessage: string;
  aiMessage: string | {
    explanation?: string;
    text?: string;
    keyPoints?: string[];
    animationStatus?: string;
    animationData?: Array<{step: number, url: string}> | null;
    chunks?: Array<{
      content: string;
      type: string;
      step: number;
    }>;
    animation?: {
      type: string;
      style: string;
    };
  };
}

export default function ChatMessage({ userMessage, aiMessage }: ChatMessageProps) {
  const renderAiResponse = () => {
    if (!aiMessage) return null;
    
    if (typeof aiMessage === 'string') {
      return <p className="text-foreground">{aiMessage}</p>;
    }
    
    if (typeof aiMessage === 'object' && aiMessage.explanation) {
      return <p className="text-foreground">{aiMessage.explanation}</p>;
    }
    
    if (typeof aiMessage === 'object' && aiMessage.text) {
      return <p className="text-foreground">{aiMessage.text}</p>;
    }
    
    return (
      <p className="text-foreground">
        {JSON.stringify(aiMessage, null, 2)}
      </p>
    );
  };
  
  return (
    <div className="mb-6">
      {/* User message */}
      <div className="flex items-start mb-4">
        <div className="h-8 w-8 rounded-full bg-primary-foreground flex items-center justify-center text-primary font-medium mr-3">
          U
        </div>
        <div className="bg-muted p-3 rounded-lg max-w-[80%]">
          <p className="text-foreground">{userMessage}</p>
        </div>
      </div>

      {/* AI message */}
      {aiMessage && (
        <div className="flex items-start">
          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-medium mr-3">
            V
          </div>
          <div className="bg-primary/10 p-3 rounded-lg max-w-[80%]">
            {renderAiResponse()}
          </div>
        </div>
      )}
    </div>
  );
}
