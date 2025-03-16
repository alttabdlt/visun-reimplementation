import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const manimServiceRoot = Deno.env.get('MANIM_SERVICE_URL') || "https://manim-service-589284378993.us-central1.run.app";
  const manimServiceUrl = `${manimServiceRoot}/execute-manim`;
  
  // Add this before making the main request
  console.log("Testing Manim service at:", manimServiceUrl);

  // First check if the service is available
  let serviceAvailable = false;
  try {
    const pingResponse = await fetch(manimServiceRoot, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
    });
    
    serviceAvailable = pingResponse.ok;
    if (!serviceAvailable) {
      console.warn(`Manim service unavailable (status: ${pingResponse.status})`);
      // Return helpful diagnostic information
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Manim service unavailable (status: ${pingResponse.status})`,
          serviceUrl: manimServiceRoot,
          timestamp: new Date().toISOString()
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error("Cannot reach Manim service:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: `Cannot reach Manim service: ${error.message}`,
        serviceUrl: manimServiceRoot,
        timestamp: new Date().toISOString()
      }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Simple test animation
  const testManimCode = `
from manim import *

class TestScene(Scene):
    def construct(self):
        circle = Circle()
        self.play(Create(circle))
        self.wait(1)
        square = Square().next_to(circle, RIGHT)
        self.play(Create(square))
        self.wait(1)
  `;
  
  try {
    console.log("Testing Manim service at:", manimServiceUrl);
    
    // Generate a unique test ID
    const testId = "test-" + new Date().getTime();
    
    // Call the Manim service directly
    const response = await fetch(manimServiceUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        code: testManimCode, 
        messageId: testId
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Manim service error: ${errorData}`);
    }
    
    const result = await response.json();
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        result,
        testId,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error("Test Manim error:", error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});