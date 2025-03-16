import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// Define CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

// Function to process text into structured chunks for animation
function processTextIntoChunks(text: string) {
  // For fine-tuned model approach, we can optionally skip chunking
  const skipChunking = Deno.env.get('USE_FINETUNED_MODEL') === 'true';
  
  if (skipChunking) {
    // When using fine-tuned model, we just need to return the full text as a single chunk
    return [{
      content: text,
      type: 'text',
      step: 1
    }];
  }
  
  // Original chunking logic for the OpenAI API approach
  const paragraphs = text.split('\n\n').filter(p => p.trim().length > 0);
  return paragraphs.map((paragraph, index) => ({
    content: paragraph,
    type: paragraph.includes('$') || paragraph.includes('\\(') || paragraph.includes('\\begin{') ? 'equation' : 'text',
    step: index + 1
  }));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check environment variables at request time, not at load time
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('Missing OPENAI_API_KEY environment variable');
    }
    
    // Environment variables for Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl) {
      throw new Error('Missing SUPABASE_URL environment variable');
    }
    
    if (!supabaseServiceKey) {
      throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable');
    }
    
    // Construct the functions URL from the project URL if not explicitly provided
    let supabaseFunctionsUrl = Deno.env.get('SUPABASE_FUNCTIONS_URL');
    console.log('Initial SUPABASE_FUNCTIONS_URL:', supabaseFunctionsUrl);
    
    if (!supabaseFunctionsUrl) {
      // Extract the project reference from the URL
      // URL format: https://[project-ref].supabase.co
      const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
      console.log('Extracted project ref:', projectRef);
      
      if (projectRef) {
        supabaseFunctionsUrl = `https://${projectRef}.supabase.co/functions/v1`;
        console.log(`Automatically determined functions URL: ${supabaseFunctionsUrl}`);
      } else {
        // Fallback for localhost or custom domains
        supabaseFunctionsUrl = `${supabaseUrl}/functions/v1`;
        console.log(`Fallback functions URL: ${supabaseFunctionsUrl}`);
      }
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { query, sessionId, generateAnimation = false } = await req.json();
    if (!query) {
      throw new Error('Query is required');
    }

    console.log('Received query:', query);
    console.log('Generate animation:', generateAnimation);
    console.log('Session ID:', sessionId);

    // Check if this query has already been processed in this session
    if (sessionId) {
      const { data: existingMessages, error: lookupError } = await supabase
        .from('chat_messages')
        .select('id, animation_status, animation_url')
        .eq('user_query', query)
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (lookupError) {
        console.error('Error looking up existing messages:', lookupError);
      } else if (existingMessages && existingMessages.length > 0) {
        const existingMessage = existingMessages[0];
        console.log(`Found existing message for query "${query}" in session ${sessionId}: ID ${existingMessage.id}`);
        
        // If there's an existing message that doesn't have animations but should have,
        // we can update its status and trigger animation generation
        if (generateAnimation && existingMessage.animation_status !== 'completed' && !existingMessage.animation_url) {
          console.log(`Updating existing message ${existingMessage.id} to generate animation`);
          
          // Update the animation status if needed
          if (existingMessage.animation_status !== 'pending' && existingMessage.animation_status !== 'processing') {
            const { error: updateError } = await supabase
              .from('chat_messages')
              .update({ animation_status: 'pending' })
              .eq('id', existingMessage.id);
              
            if (updateError) {
              console.error('Error updating existing message status:', updateError);
            }
          }
          
          try {
            console.log(`Triggering animation generation for existing message ${existingMessage.id}`);
            // Trigger animation generation for the existing message
            const generateResponse = await fetch(`${supabaseFunctionsUrl}/generate-animation`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
                'apikey': supabaseServiceKey
              },
              body: JSON.stringify({ messageId: existingMessage.id })
            });
            
            if (!generateResponse.ok) {
              const errorText = await generateResponse.text();
              console.warn(`Animation generation for existing message returned error: ${generateResponse.status} - ${errorText}`);
            } else {
              console.log('Animation generation for existing message triggered successfully');
            }
          } catch (genError) {
            console.error('Failed to trigger animation for existing message:', genError);
          }
        }
        
        // Return the existing message ID rather than creating a duplicate
        return new Response(
          JSON.stringify({ 
            success: true, 
            messageId: existingMessage.id, 
            existing: true,
            animationStatus: existingMessage.animation_status
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const systemMessage = {
      role: 'system',
      content: `You are an educational assistant that explains concepts clearly and step by step. 
      Break down complex topics into simple, visual explanations. 
      For mathematical concepts, include appropriate equations.
      Provide explanations that can be turned into animations.`
    };

    console.log('Calling OpenAI API...');
    
    // Direct API call to OpenAI instead of using the SDK
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [systemMessage, { role: "user", content: query }],
        temperature: 0.7,
        max_tokens: 1000
      })
    });
    
    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.text();
      console.error(`OpenAI API error: ${openaiResponse.status} - ${errorData}`);
      
      // Check if it's a model access error
      if (errorData.includes("does not exist or you do not have access to it")) {
        throw new Error(`Model access error: Your account doesn't have access to the requested model. Using gpt-3.5-turbo instead.`);
      } else {
        throw new Error(`OpenAI API error: ${errorData}`);
      }
    }
    
    const completionData = await openaiResponse.json();
    const aiResponse = completionData.choices[0]?.message?.content;
    
    if (!aiResponse) {
      throw new Error('OpenAI returned an empty response');
    }

    console.log('Received AI response of length:', aiResponse.length);

    const chunks = processTextIntoChunks(aiResponse);

    const { data: message, error: insertError } = await supabase
      .from('chat_messages')
      .insert({
        user_query: query,
        session_id: sessionId || null,
        ai_response: {
          explanation: aiResponse,
          chunks,
          animation: { type: 'default', style: 'standard' }
        },
        animation_status: generateAnimation ? 'pending' : 'disabled'
      })
      .select()
      .single();

    if (insertError || !message) {
      console.error('Database insert error:', insertError);
      throw new Error(`Failed to save message: ${insertError?.message || 'Unknown error'}`);
    }

    // Trigger animation generation asynchronously only if generateAnimation is true
    if (generateAnimation) {
      try {
        console.log(`Triggering animation generation for message ${message.id} at URL ${supabaseFunctionsUrl}/generate-animation`);
        
        // Modified request to fix authorization and add proper error handling
        const generateResponse = await fetch(`${supabaseFunctionsUrl}/generate-animation`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'apikey': supabaseServiceKey
          },
          body: JSON.stringify({ messageId: message.id })
        });

        // Check response status and handle errors more gracefully
        if (!generateResponse.ok) {
          const errorText = await generateResponse.text();
          console.warn(`Animation generation triggered but returned an error: ${generateResponse.status} - ${errorText || "Empty response"}`);
        } else {
          const result = await generateResponse.json();
          console.log('Animation generation triggered successfully:', result);
        }
      } catch (genError) {
        console.error('Failed to trigger animation generation:', genError);
        // We continue even if animation generation fails
        // The UI can still show the explanation and poll for animation later
      }
    } else {
      console.log(`Animation generation skipped for message ${message.id} as per user request`);
    }

    return new Response(
      JSON.stringify({ success: true, messageId: message.id, explanation: aiResponse }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing query:', error);

    // Create a user-friendly error message
    let userFriendlyError = 'Sorry, I couldn\'t process your request. Please try again.';
    
    // Provide more specific messages for common errors
    if (error.message.includes("does not exist or you do not have access to it")) {
      userFriendlyError = 'The system is currently using a model that\'s not available. The administrator has been notified.';
    } else if (error.message.includes("OpenAI API error")) {
      userFriendlyError = 'There was an issue connecting to our AI service. Please try again in a few moments.';
    } else if (error.message.includes("Missing")) {
      userFriendlyError = 'The system is missing some configuration. The administrator has been notified.';
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: userFriendlyError,
        details: error.message || 'Unknown error' // Keep the detailed error for debugging
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
