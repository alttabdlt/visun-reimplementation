// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

console.log("Hello from Functions!")

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messageId } = await req.json();
    
    // Initialize Supabase client
    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);
    
    // Get the message data
    const { data: message, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('id', messageId)
      .single();
    
    if (error) throw new Error('Message not found');
    
    // Extract content for embedding
    const content = JSON.stringify({
      explanation: message.ai_response.explanation,
      animation: message.ai_response.animation
    });
    
    // Extract key terms
    const keyTerms = extractKeyTerms(message.ai_response.explanation);
    
    // Generate embedding using OpenAI
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: content
      }),
    });
    
    if (!embeddingResponse.ok) {
      throw new Error('Failed to generate embedding');
    }
    
    const embeddingData = await embeddingResponse.json();
    const embedding = embeddingData.data[0].embedding;
    
    // Store the embedding
    const { data: embeddingResult, error: embeddingError } = await supabase
      .from('animation_embeddings')
      .insert({
        message_id: messageId,
        content: content,
        embedding: embedding,
        key_terms: keyTerms
      })
      .select()
      .single();
    
    if (embeddingError) throw new Error(`Failed to store embedding: ${embeddingError.message}`);
    
    return new Response(
      JSON.stringify({ success: true, embeddingId: embeddingResult.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function extractKeyTerms(text: string): string[] {
  // More sophisticated extraction of key terms
  // Include mathematical expressions
  const mathRegex = /\$[^$]+\$|\\\(.*?\\\)|\\\[.*?\\\]|\\begin\{[^}]+\}[^]*?\\end\{[^}]+\}/g;
  const mathTerms = text.match(mathRegex) || [];
  
  // Extract keywords
  const keywordRegex = /\b[A-Z][a-z]{2,}\b|\b[a-z]{3,}\b/g;
  const keywords = text.match(keywordRegex) || [];
  
  // Extract numbers with units
  const unitRegex = /\b\d+(\.\d+)?\s*[a-zA-Z]+\b/g;
  const units = text.match(unitRegex) || [];
  
  // Remove duplicates and return
  return [...new Set([...mathTerms, ...keywords, ...units])];
}