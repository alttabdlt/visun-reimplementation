import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Configuration settings
const MANIM_SERVICE_URL = "https://manim-service-589284378993.us-central1.run.app";
const MANIM_EXECUTE_ENDPOINT = `${MANIM_SERVICE_URL}/execute-manim`;
const PLACEHOLDER_URL = `${MANIM_SERVICE_URL}/placeholder-animation.mp4`;

// CORS headers for cross-origin requests
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Fetch with timeout helper function
 * @param url URL to fetch
 * @param options Fetch options
 * @param timeout Timeout in milliseconds
 * @returns Promise resolving to fetch response
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 30000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    console.log(`Fetching: ${url}`);
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Check if the Manim service is healthy
 * @returns Promise resolving to a boolean indicating if the service is available
 */
async function checkManimServiceHealth(): Promise<boolean> {
  try {
    console.log(`Checking Manim service health at: ${MANIM_SERVICE_URL}`);
    const startTime = Date.now();
    
    // Try multiple endpoints if the root fails
    const endpoints = ["/", "/health", "/status"];
    let success = false;
    let lastError = null;
    
    for (const endpoint of endpoints) {
      if (success) break;
      
      try {
        const response = await fetchWithTimeout(`${MANIM_SERVICE_URL}${endpoint}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        }, 10000);
        
        if (response.ok || response.status === 404) {
          // A 404 on a health endpoint still means the service is running
          success = true;
          console.log(`Manim service health check passed using endpoint ${endpoint}`);
          break;
        } else {
          console.warn(`Health check failed on ${endpoint} with status: ${response.status}`);
          const errorText = await response.text();
          lastError = `Status ${response.status}: ${errorText}`;
        }
      } catch (error) {
        console.warn(`Health check error on ${endpoint}: ${error.message}`);
        lastError = error.message;
      }
    }
    
    const elapsed = Date.now() - startTime;
    console.log(`Health check took ${elapsed}ms, result: ${success ? 'Available' : 'Unavailable'}`);
    
    if (!success && lastError) {
      console.error(`All health checks failed. Last error: ${lastError}`);
    }
    
    return success;
  } catch (error) {
    console.error(`Unexpected health check error: ${error.message}`);
    return false;
  }
}

/**
 * Execute Manim code on the service
 * @param code The Manim Python code to execute
 * @param messageId The message ID for tracking
 * @param step Optional step number for multi-step animations
 * @returns Promise resolving to execution result
 */
async function executeManimCode(code: string, messageId: string, step?: number): Promise<any> {
  const uniqueMessageId = step ? `${messageId}_step${step}` : messageId;
  console.log(`Executing Manim code for message ${uniqueMessageId}`);
  
  try {
    const response = await fetchWithTimeout(MANIM_EXECUTE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        code: code, 
        messageId: uniqueMessageId 
      })
    }, 300000); // 5-minute timeout for animation generation
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Manim execution failed (${response.status}): ${errorText}`);
      throw new Error(`Manim service error (${response.status}): ${errorText}`);
    }
    
    const result = await response.json();
    console.log(`Manim execution succeeded: ${JSON.stringify(result)}`);
    return result;
  } catch (error) {
    console.error(`Manim execution error: ${error.message}`);
    throw error;
  }
}

// Serve the function
serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }
  
  console.log(`Received request: ${req.method} ${req.url}`);
  
  try {
    // Parse the request
    const { code, messageId, step } = await req.json();
    
    // Validate required inputs
    if (!code) {
      console.warn('Missing required parameter: code');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Manim code is required',
          url: PLACEHOLDER_URL
        }),
        { 
          status: 400, 
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    if (!messageId) {
      console.warn('Missing required parameter: messageId');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Message ID is required',
          url: PLACEHOLDER_URL
        }),
        { 
          status: 400, 
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Check if the Manim service is available
    const serviceAvailable = await checkManimServiceHealth();
    
    // If service is unavailable, return a fallback placeholder animation
    if (!serviceAvailable) {
      console.warn('Manim service health check failed, returning placeholder');
      return new Response(
        JSON.stringify({ 
          success: false,
          url: PLACEHOLDER_URL,
          error: "Manim service is currently unavailable" 
        }),
        { 
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Execute the Manim code
    try {
      const result = await executeManimCode(code, messageId, step);
      
      // Return the successful result
      return new Response(
        JSON.stringify({
          success: true,
          ...result
        }),
        { 
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } 
        }
      );
    } catch (error) {
      console.error(`Execution error: ${error.message}`);
      
      // Return error with placeholder
      return new Response(
        JSON.stringify({
          success: false,
          url: PLACEHOLDER_URL,
          error: error.message || 'Failed to execute Manim code'
        }),
        { 
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } 
        }
      );
    }
  } catch (error) {
    // Handle overall request errors
    console.error(`Request error: ${error.message}`);
    
    return new Response(
      JSON.stringify({
        success: false,
        url: PLACEHOLDER_URL,
        error: error.message || 'An unexpected error occurred'
      }),
      { 
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      }
    );
  }
});