"use client";

import { ReactNode, useState, useRef, useEffect, useMemo, useCallback } from "react";
import { LinkIcon, CopyIcon, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import ReactMarkdown from 'react-markdown';

export interface ChatMessageProps {
  content: ReactNode;
  isUser?: boolean;
  timestamp?: string;
  keyPoints?: string[];
  animationStatus?: string | null;
  animationData?: Array<{step: number, url: string}> | null;
  messageId?: number;
}

function AnimationPlayer({
  animationData,
  selectedStep,
  onVideoError,
  onPrevStep,
  onNextStep,
  currentAnimationUrl
}: {
  animationData: Array<{step: number, url: string}>;
  selectedStep: number;
  onVideoError: () => void;
  onPrevStep: () => void;
  onNextStep: () => void;
  currentAnimationUrl: string | null;
}) {
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Handle client-side initialization
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  // Log animation details for debugging
  useEffect(() => {
    if (isMounted) {
      console.log("Current animation URL in player:", currentAnimationUrl);
      console.log("Is placeholder?", currentAnimationUrl?.includes('placeholder-animation'));
    }
  }, [currentAnimationUrl, isMounted]);

  // Automatically retry loading up to 3 times if there's an error
  const handleVideoError = useCallback((e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    console.error("Video error:", e);
    console.log("Failed URL:", currentAnimationUrl);
    
    if (retryCount < 3) {
      console.log(`Auto-retrying (attempt ${retryCount + 1}/3)...`);
      setIsRetrying(true);
      
      // Wait a moment before retrying with increasing delay
      setTimeout(() => {
        setRetryCount(count => count + 1);
        setIsRetrying(false);
        
        // Force reload the video element
        if (videoRef.current) {
          const video = videoRef.current;
          const currentSrc = video.src;
          video.src = '';
          // Force browser to see this as a new resource
          setTimeout(() => {
            // Add a unique timestamp to ensure browser doesn't use cached version
            const cacheBusterUrl = currentSrc.includes('?') 
              ? `${currentSrc}&retry=${Date.now()}` 
              : `${currentSrc}?retry=${Date.now()}`;
            
            video.src = cacheBusterUrl;
            video.load();
            video.play().catch(err => console.log("Play error during retry:", err));
          }, 100);
        }
      }, 1000 * Math.pow(2, retryCount)); // Exponential backoff: 1s, 2s, 4s
    } else {
      // After 3 retries, report the error to parent
      console.log("Retry failed after 3 attempts, reporting error to parent");
      onVideoError();
    }
  }, [currentAnimationUrl, retryCount, onVideoError]);
  
  const handleVideoLoaded = useCallback(() => {
    console.log("Video loaded successfully:", currentAnimationUrl);
    setHasLoaded(true);
    
    // Autoplay the video once loaded
    if (videoRef.current) {
      videoRef.current.play().catch(err => {
        console.warn("Autoplay failed (common on mobile):", err);
      });
    }
  }, [currentAnimationUrl]);
  
  // Reset retry count when URL changes
  useEffect(() => {
    if (isMounted) {
      setRetryCount(0);
      setIsRetrying(false);
      setHasLoaded(false);
    }
  }, [currentAnimationUrl, isMounted]);
  
  // Ensure the video always has a source URL
  const safeUrl = currentAnimationUrl || "https://xavafuqrqucwbjxxcgqk.supabase.co/storage/v1/object/public/animations/placeholder-animation.mp4";
  
  // Only render the video component on the client side to avoid hydration warnings
  if (!isMounted) {
    return <div className="w-full h-48 bg-gray-100 animate-pulse rounded-md" />;
  }
  
  return (
    <div className="relative">
      {!hasLoaded && !isRetrying && (
        <div className="absolute inset-0 bg-black bg-opacity-10 flex items-center justify-center rounded-md">
          <div className="text-white flex items-center space-x-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading Animation...</span>
          </div>
        </div>
      )}
      
      {isRetrying && (
        <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center rounded-md">
          <div className="text-white flex items-center space-x-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Retrying... (Attempt {retryCount}/3)</span>
          </div>
        </div>
      )}
      
      <div className="relative">
        <video 
          ref={videoRef}
          src={safeUrl}
          controls 
          className="w-full rounded-md"
          autoPlay
          playsInline
          preload="auto"
          loop
          crossOrigin="anonymous"
          onError={handleVideoError}
          onLoadedData={handleVideoLoaded}
        />
      </div>
      
      {/* Step navigation if multiple animations */}
      {animationData && animationData.length > 1 && (
        <div className="flex items-center justify-between mt-2">
          <Button 
            onClick={onPrevStep}
            disabled={selectedStep === 0}
            variant="outline"
            size="sm"
            className="h-8 rounded-full border-secondary bg-secondary/20 text-xs font-medium"
          >
            Previous
          </Button>
          <span className="text-sm">
            Step {selectedStep + 1} of {animationData.length}
          </span>
          <Button 
            onClick={onNextStep}
            disabled={selectedStep === animationData.length - 1}
            variant="outline"
            size="sm"
            className="h-8 rounded-full border-secondary bg-secondary/20 text-xs font-medium"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

export function ChatMessage({ 
  content, 
  isUser = false, 
  timestamp, 
  keyPoints,
  animationStatus,
  animationData,
  messageId
}: ChatMessageProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [selectedStep, setSelectedStep] = useState(0);
  const [hasVideoError, setHasVideoError] = useState(false);
  
  // Format message for markdown if it's a string
  const formattedContent = useMemo(() => {
    if (isUser || typeof content !== 'string') return content;
    
    try {
      // Pattern to match "Step X: " patterns
      return content.replace(
        /(Step \d+:)/g, 
        '\n\n**$1**\n\n'
      ).trim();
    } catch (error) {
      console.error("Error formatting message:", error);
      return content; // Return original message on error
    }
  }, [content, isUser]);
  
  // Safely get the current animation URL based on selected step
  const currentAnimationUrl = useMemo(() => {
    // Reliable Supabase storage URL for placeholder animation
    const SUPABASE_PLACEHOLDER = "https://xavafuqrqucwbjxxcgqk.supabase.co/storage/v1/object/public/animations/placeholder-animation.mp4";
    
    try {
      if (animationData && Array.isArray(animationData) && animationData.length > 0) {
        // Ensure selectedStep is within bounds
        const validStep = Math.min(selectedStep, animationData.length - 1);
        let url = animationData[validStep]?.url || null;
        
        // For debugging only - remove in production
        console.log("Animation data:", JSON.stringify(animationData));
        console.log("Selected step:", validStep);
        console.log("Original animation URL:", url);
        
        // Handle null or undefined URLs
        if (!url) {
          console.warn("Null or undefined animation URL");
          return SUPABASE_PLACEHOLDER;
        }
        
        // IMPORTANT: Check explicitly for placeholder animation strings
        if (url.includes('/placeholder-animation.mp4') || url.includes('manim-service') && url.includes('placeholder-animation.mp4')) {
          console.log("Detected placeholder animation URL");
          return SUPABASE_PLACEHOLDER;
        }
        
        // Check if URL is already a Supabase storage URL
        if (url.includes('supabase.co/storage/v1/object/public/animations')) {
          console.log("URL is already a Supabase storage URL:", url);
          // Add a cache-busting parameter to force a fresh load
          return url + (url.includes('?') ? '&' : '?') + '_cb=' + Date.now();
        }
        
        // Fix relative URLs by adding the Manim service base URL
        if (url.startsWith('/')) {
          url = `https://manim-service-589284378993.us-central1.run.app${url}`;
          console.log("Fixed relative URL:", url);
        }
        
        // Make sure URL is valid
        try {
          new URL(url);
          console.log("Valid URL format:", url);
          // Add a cache-busting parameter to force a fresh load
          return url + (url.includes('?') ? '&' : '?') + '_cb=' + Date.now();
        } catch (e) {
          console.error("Invalid URL format:", url);
          return SUPABASE_PLACEHOLDER;
        }
      }
      // Fallback to Supabase storage
      return SUPABASE_PLACEHOLDER;
    } catch (error) {
      console.error("Error accessing animation URL:", error);
      // Fallback to Supabase storage
      return SUPABASE_PLACEHOLDER;
    }
  }, [animationData, selectedStep]);
  
  // Reset error state and selected step when animation data changes
  useEffect(() => {
    try {
      setSelectedStep(0);
      setHasVideoError(false);
    } catch (error) {
      console.error("Error in animation data effect:", error);
    }
  }, [animationData]);
  
  // Add polling for animation status updates
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    
    const pollAnimationStatus = async () => {
      if (!messageId || animationStatus === 'completed' || animationStatus === 'disabled') {
        return;
      }
      
      try {
        // Query the latest status
        const { data, error } = await supabase
          .from('chat_messages')
          .select('animation_status, animation_url')
          .eq('id', messageId)
          .single();
        
        if (error) throw error;
        
        // Check if we have valid animation data to update
        if (data && data.animation_status === 'completed' && data.animation_url) {
          console.log('Animation completed! Refreshing data:', data.animation_url);
          // Don't reload entire page - fetch and update data directly
          window.location.reload();
        }
      } catch (err) {
        console.error("Error polling animation status:", err);
      }
    };
    
    // Set up polling if we have a pending or processing animation
    if (messageId && (animationStatus === 'pending' || animationStatus === 'processing')) {
      intervalId = setInterval(pollAnimationStatus, 5000); // Poll every 5 seconds
      console.log(`Started polling for message ${messageId} with status ${animationStatus}`);
    }
    
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [messageId, animationStatus]);

  // Handle client-side only operations
  const [isClient, setIsClient] = useState(false);
  
  // Set isClient to true once the component mounts
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Handle step navigation
  const handlePrevStep = () => {
    if (selectedStep > 0) {
      setSelectedStep(prev => prev - 1);
      setHasVideoError(false);
    }
  };
  
  const handleNextStep = () => {
    if (animationData && selectedStep < animationData.length - 1) {
      setSelectedStep(prev => prev + 1);
      setHasVideoError(false);
    }
  };
  
  const handleVideoError = () => {
    console.error("Video playback error for URL:", currentAnimationUrl);
    setHasVideoError(true);
  };
  
  // Handle retry animation generation
  const handleRetry = async () => {
    try {
      if (!messageId) {
        toast.error("Cannot retry without message ID");
        return;
      }
      
      setIsRetrying(true);
      
      // Update status back to pending
      await supabase
        .from('chat_messages')
        .update({ animation_status: 'pending' })
        .eq('id', messageId);
      
      // Call the generate-animation function directly
      const { error } = await supabase.functions.invoke('generate-animation', {
        body: { messageId }
      });
      
      if (error) {
        throw new Error(error.message);
      }
      
      toast.success("Animation generation restarted");
      setHasVideoError(false);
    } catch (error) {
      console.error("Error retrying animation:", error);
      toast.error("Failed to retry animation generation");
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="w-full py-8 border-b border-border/30">
      <div className="container max-w-3xl mx-auto px-4">
        <div className="flex gap-4">
          {!isUser && (
            <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center shrink-0">
              G
            </div>
          )}
          {isUser && (
            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
              </svg>
            </div>
          )}
          <div className="flex-1">
            <div className="prose max-w-none">
              {typeof formattedContent === 'string' ? (
                <ReactMarkdown>{formattedContent}</ReactMarkdown>
              ) : (
                formattedContent
              )}

              {keyPoints && keyPoints.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold mb-2">Key Points</h3>
                  <ul className="list-disc pl-5 space-y-2">
                    {keyPoints.map((point, index) => (
                      <li key={index}>{point}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Animation status */}
            {!isUser && animationStatus && animationStatus !== 'completed' && animationStatus !== 'disabled' && (
              <div className="mt-3 pt-2 border-t border-gray-200">
                {animationStatus === 'pending' && (
                  <div className="flex items-center text-gray-500 text-sm">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Preparing animation...
                  </div>
                )}
                
                {animationStatus === 'processing' && (
                  <div className="flex items-center text-gray-500 text-sm">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Generating animation...
                  </div>
                )}
                
                {animationStatus === 'failed' && (
                  <div className="flex flex-col gap-2">
                    <div className="text-red-500 text-sm">
                      Failed to generate animation.
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleRetry}
                      disabled={isRetrying}
                    >
                      {isRetrying ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Retrying...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Retry Animation
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
            
            {/* Animation display */}
            {!isUser && animationStatus === 'completed' && currentAnimationUrl && (
              <div className="mt-4">
                {hasVideoError ? (
                  <div className="flex flex-col gap-2 p-3 rounded-md bg-amber-50 text-sm">
                    <p className="text-amber-600 font-medium">Unable to load animation.</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleRetry}
                      disabled={isRetrying}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Retry Loading
                    </Button>
                  </div>
                ) : (
                  animationData && (
                    <AnimationPlayer 
                      animationData={animationData}
                      selectedStep={selectedStep}
                      onVideoError={handleVideoError}
                      onPrevStep={handlePrevStep}
                      onNextStep={handleNextStep}
                      currentAnimationUrl={currentAnimationUrl}
                    />
                  )
                )}
              </div>
            )}

            {!isUser && (
              <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
                {/* Only render share button on client */}
                {isClient && messageId && (
                  <button 
                    className="flex items-center gap-1 hover:text-foreground"
                    onClick={async () => {
                      try {
                        if (typeof window !== 'undefined' && messageId) {
                          const shareUrl = `${window.location.origin}/chat?message=${messageId}`;
                          
                          // Use document.execCommand directly to avoid permission issues
                          const textArea = document.createElement('textarea');
                          textArea.value = shareUrl;
                          textArea.style.position = 'fixed';  // Avoid scrolling to bottom
                          textArea.style.opacity = '0';
                          document.body.appendChild(textArea);
                          textArea.focus();
                          textArea.select();
                          
                          try {
                            const successful = document.execCommand('copy');
                            if (successful) {
                              toast.success("Share link copied to clipboard");
                            } else {
                              toast.error("Failed to copy share link");
                            }
                          } catch (err) {
                            toast.error("Failed to copy share link");
                          }
                          
                          document.body.removeChild(textArea);
                        } else {
                          toast.error("Cannot create share link for this message");
                        }
                      } catch (error) {
                        console.error("Error copying share link:", error);
                        toast.error("Failed to copy share link");
                      }
                    }}
                  >
                    <LinkIcon className="w-4 h-4" />
                    Share
                  </button>
                )}
                <button 
                  className="flex items-center gap-1 hover:text-foreground"
                  onClick={async () => {
                    try {
                      if (typeof content === 'string') {
                        // Use document.execCommand directly to avoid permission issues
                        const textArea = document.createElement('textarea');
                        textArea.value = content;
                        textArea.style.position = 'fixed';  // Avoid scrolling to bottom
                        textArea.style.opacity = '0';
                        document.body.appendChild(textArea);
                        textArea.focus();
                        textArea.select();
                        
                        try {
                          const successful = document.execCommand('copy');
                          if (successful) {
                            toast.success("Content copied to clipboard");
                          } else {
                            toast.error("Failed to copy content");
                          }
                        } catch (err) {
                          toast.error("Failed to copy content");
                        }
                        
                        document.body.removeChild(textArea);
                      } else {
                        toast.error("Cannot copy this content type");
                      }
                    } catch (error) {
                      console.error("Error copying content:", error);
                      toast.error("Failed to copy content");
                    }
                  }}
                >
                  <CopyIcon className="w-4 h-4" />
                  <span>Copy</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
