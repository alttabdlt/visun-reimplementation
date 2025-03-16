import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import * as crypto from "https://deno.land/std@0.167.0/crypto/mod.ts";

// Define constants for absolute URLs
const MANIM_SERVICE_URL = Deno.env.get('MANIM_SERVICE_URL') || "https://manim-service-589284378993.us-central1.run.app";
console.log('Using MANIM_SERVICE_URL:', MANIM_SERVICE_URL);
const PLACEHOLDER_ANIMATION_URL = `${MANIM_SERVICE_URL}/placeholder-animation.mp4`;
const ERROR_ANIMATION_URL = `${MANIM_SERVICE_URL}/placeholder-animation.mp4`;
const PLACEHOLDER_IMAGE_URL = `${MANIM_SERVICE_URL}/placeholder-animation.mp4`;

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Add expanded type definitions
type ContentChunk = {
  content: string;
  type: string;
  step?: number;
};

type AnimationUrl = {
  step: number;
  url: string;
};

type StepCode = {
  step: number;
  code: string;
};

// Add this interface at the top of your file or before the generateManimCode function
interface ManimCodeItem {
  step: number;
  code: string;
}

// Add this function anywhere before it's used, like with other utility functions
function cleanManimCode(code: string): string {
  return code
    .replace(/```python\n/g, '')
    .replace(/```\n/g, '')
    .replace(/```/g, '')
    .trim();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let messageId; // Declare messageId outside the try block
  
  try {
    const requestData = await req.json();
    messageId = requestData.messageId; // Assign the value from the request
    
    if (!messageId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing messageId parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Initialize Supabase client
    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);
    
    // Update message status to processing
    await supabase
      .from('chat_messages')
      .update({ animation_status: 'processing' })
      .eq('id', messageId);
    
    // IMPORTANT CHANGE: Immediately respond to prevent timeout
    // Start processing in the background
    processAnimationInBackground(messageId, supabase)
      .catch(error => {
        console.error(`Background animation processing error for message ${messageId}:`, error);
        // Update the message with error status
        updateMessageWithError(supabase, messageId, error.message || "Animation generation failed")
          .catch(updateError => {
            console.error(`Failed to update error status: ${updateError}`);
          });
      });
    
    // Return immediate success response
    return new Response(
      JSON.stringify({ success: true, message: 'Animation generation started' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error in animation request:', error);
    
    // Create a user-friendly error message
    let userFriendlyError = 'Sorry, I couldn\'t generate the animation. Please try again.';
    
    // Provide more specific messages for common errors
    if (error.message?.includes("does not exist or you do not have access to it")) {
      userFriendlyError = 'The system is currently using a model that\'s not available. The administrator has been notified.';
    } else if (error.message?.includes("OpenAI API error")) {
      userFriendlyError = 'There was an issue connecting to our AI service. Please try again in a few moments.';
    } else if (error.message?.includes("Missing")) {
      userFriendlyError = 'The system is missing some configuration. The administrator has been notified.';
    }
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: userFriendlyError,
        details: error.message || 'Unknown error', // Keep the detailed error for debugging
        messageId 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

// New function for generating Manim code with a fine-tuned model
async function generateManimCodeWithFineTunedModel(
  explanation: string, 
  animationSettings: any
): Promise<ManimCodeItem[]> {
  try {
    console.log(`Generating Manim code using fine-tuned model for explanation of length ${explanation.length}`);
    
    // Get the fine-tuned model endpoint from environment variables with fallback
    const modelEndpoint = Deno.env.get('FINE_TUNED_MODEL_ENDPOINT') || 
                          "https://api-inference.huggingface.co/models/your-username/manim-model";
    const apiKey = Deno.env.get('HF_API_KEY'); // Hugging Face API key
    
    // Prepare prompt in the format the model was trained on
    const prompt = `Create a Manim animation for the following content:
      
${explanation}
      
Animation Style: ${animationSettings?.style || 'standard'}`;
    
    // Call your deployed fine-tuned model API
    const response = await fetch(modelEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': apiKey ? `Bearer ${apiKey}` : '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 2000,
          temperature: 0.3,
          return_full_text: false
        }
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Model API error: ${response.status} - ${errorText}`);
      throw new Error(`Fine-tuned model API error: ${response.status}`);
    }
    
    const result = await response.json();
    // Format varies between HF endpoints and custom endpoints
    const manimCode = typeof result === 'string' ? result : 
                      Array.isArray(result) ? result[0].generated_text : 
                      result.generated_text || result.output || '';
    
    if (!manimCode) {
      throw new Error('Empty response from fine-tuned model');
    }
    
    // Clean up and add safeguards to the code
    const processedCode = addManimSafeguards(cleanManimCode(manimCode));
    
    console.log(`Generated Manim code of length ${processedCode.length}`);
    
    // Return as a single-step code
    return [{
      step: 1,
      code: processedCode
    }];
    
  } catch (error) {
    console.error('Error generating Manim code with fine-tuned model:', error);
    
    // Fall back to OpenAI if available
    if (openAIApiKey) {
      console.log('Falling back to OpenAI for code generation');
      try {
        const dummyChunks = [{
          content: explanation,
          type: 'text',
          step: 1
        }];
        return await generateManimCode(dummyChunks, animationSettings);
      } catch (fallbackError) {
        console.error('Fallback to OpenAI also failed:', fallbackError);
      }
    }
    
    // Return fallback code as last resort
    return [{
      step: 1,
      code: createFallbackManimCode(1, [{ content: explanation, type: 'text' }])
    }];
  }
}

// Modify the processAnimationInBackground function to use our fine-tuned model
async function processAnimationInBackground(messageId: string, supabase: any) {
  try {
    console.log(`[Background] Starting animation generation for message ${messageId}`);
    
    // Get the message data
    const { data: message, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('id', messageId)
      .single();
    
    if (error) {
      console.error(`[Background] Error fetching message: ${error.message}`);
      await updateMessageWithError(supabase, messageId, "Failed to retrieve message data");
      throw new Error('Message not found');
    }
    
    if (!message.ai_response || !message.ai_response.explanation) {
      const errorMsg = 'Invalid message structure: missing AI response or explanation';
      console.error(`[Background] ${errorMsg}`);
      await updateMessageWithError(supabase, messageId, errorMsg);
      throw new Error(errorMsg);
    }
    
    const aiResponse = message.ai_response;
    
    // Check if we already have a similar animation in our cache
    const similarAnimation = await findSimilarAnimation(aiResponse, supabase);
    if (similarAnimation) {
      console.log('[Background] Found similar animation, reusing...');
      
      // Update message with cached animation URL
      await supabase
        .from('chat_messages')
        .update({ 
          animation_url: similarAnimation,
          animation_status: 'completed'
        })
        .eq('id', messageId);
      
      return;
    }
    
    // Generate Manim code using the fine-tuned model
    console.log(`[Background] Generating Manim code for message ${messageId}`);
    
    // Use the new fine-tuned model approach instead of chunking
    const useFinetuned = Deno.env.get('USE_FINETUNED_MODEL') === 'true';
    let manimCodes;
    
    if (useFinetuned) {
      // Using fine-tuned model without chunking
      manimCodes = await generateManimCodeWithFineTunedModel(
        aiResponse.explanation,
        aiResponse.animation
      );
    } else {
      // Fallback to original chunking approach
      if (!aiResponse.chunks || !Array.isArray(aiResponse.chunks)) {
        const errorMsg = 'Invalid message structure: missing chunks array';
        console.error(`[Background] ${errorMsg}`);
        await updateMessageWithError(supabase, messageId, errorMsg);
        throw new Error(errorMsg);
      }
      
      manimCodes = await generateManimCode(aiResponse.chunks, aiResponse.animation);
    }
    
    console.log(`[Background] Generated ${manimCodes.length} Manim code blocks`);
    
    // Execute Manim code and get animation URLs
    let animationUrls;
    try {
      animationUrls = await executeManimCode(manimCodes, messageId, supabase);
    } catch (executionError) {
      console.error("[Background] Failed to execute Manim code:", executionError);
      // Use placeholder animation instead of failing
      animationUrls = await getPlaceholderAnimation(message);
    }
    
    // Store animation in RAG system for future reuse
    await storeManimAnimation(
      aiResponse,
      manimCodes,
      animationUrls,
      supabase,
      messageId
    );
    
    // Make sure the update operation is successfully completing and has proper logging
    console.log(`Updating message ${messageId} with animation status: completed and ${animationUrls.length} URLs`);

    try {
      const { error } = await supabase
        .from('chat_messages')
        .update({ 
          animation_url: animationUrls,
          animation_status: 'completed'
        })
        .eq('id', messageId);
      
      if (error) {
        console.error(`Failed to update chat_message record: ${error.message}`);
        throw error;
      }
      
      console.log(`Verified message ${messageId} update:`, message);
      
    } catch (updateError) {
      console.error(`Error during database update: ${updateError}`);
    }
    
    // Return appropriate response to API call
    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: messageId,
        animationUrls: animationUrls 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('[Background] Error generating animation:', error);
    
    // Update status to failed
    try {
      const supabase = createClient(supabaseUrl!, supabaseServiceKey!);
      await supabase
        .from('chat_messages')
        .update({ 
          animation_status: 'failed', 
          error_message: error.message || 'Unknown error',
          animation_url: [{ step: 0, url: ERROR_ANIMATION_URL }]
        })
        .eq('id', messageId);
    } catch (updateError) {
      console.error('[Background] Error updating message status:', updateError);
    }
  }
}

// Replace the existing createHash function with this implementation
async function createHash(content: string): Promise<string> {
  // Simple hash function that doesn't rely on crypto.subtle
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Convert to hex string and ensure positive
  const hashHex = (hash >>> 0).toString(16).padStart(8, '0');
  console.log(`Generated hash ${hashHex} for content`);
  return hashHex;
}

// Find similar animations in cache (RAG system)
async function findSimilarAnimation(aiResponse: any, supabase: any): Promise<AnimationUrl[] | null> {
  try {
    // Create embedding for similarity search
    const queryText = aiResponse.explanation + ' ' + JSON.stringify(aiResponse.animation);
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: queryText,
        model: 'text-embedding-3-small'
      })
    });
    
    const embeddingData = await embeddingResponse.json();
    const embedding = embeddingData.data[0].embedding;
    
    // Create content hash for exact match check
    const contentHash = await createHash(queryText);
    
    // Check for exact hash match first
    const { data: exactMatch } = await supabase
      .from('animation_cache')
      .select('animation_url')
      .eq('query_hash', contentHash)
      .maybeSingle();
      
    if (exactMatch) {
      return exactMatch.animation_url;
    }
    
    // Check for semantic similarity if no exact match
    const { data: similarMatches } = await supabase.rpc('match_animations', {
      query_embedding: embedding,
      match_threshold: 0.78,
      match_count: 1
    });
    
    if (similarMatches && similarMatches.length > 0) {
      return similarMatches[0].animation_url;
    }
    
    return null;
  } catch (error) {
    console.error('Error finding similar animation:', error);
    return null;
  }
}

// Modify the generateManimCode function to create more robust code

async function generateManimCode(chunks, animationSettings): Promise<ManimCodeItem[]> {
  // Request Manim code generation from the OpenAI API
  const manimCodes: ManimCodeItem[] = []; // Add explicit type here
  
  // Group chunks by step for better organization
  const stepChunks = new Map();
  chunks.forEach(chunk => {
    const step = chunk.step || 1;
    if (!stepChunks.has(step)) {
      stepChunks.set(step, []);
    }
    stepChunks.get(step).push(chunk);
  });
  
  console.log(`Generating Manim code for ${stepChunks.size} steps`);
  
  // Process each step sequentially
  for (const [step, chunksInStep] of stepChunks.entries()) {
    try {
      const chunksText = chunksInStep.map(c => 
        `Content: ${c.content}\nType: ${c.type}`
      ).join('\n\n');
      
      const systemPrompt = `You are an expert at creating Manim animations. 
      Create a Manim Python script for the following text content.
      
      Rules:
      1. Start with "from manim import *"
      2. Create a class called AutoScene(Scene)
      3. Implement a construct() method
      4. CRITICAL: Position ALL elements at the center of the screen using .move_to(ORIGIN)
      5. CRITICAL: Use .scale() to ensure elements fit on screen (usually 0.5-0.8 scale)
      6. Use only basic Manim features like Text, MathTex, Arrow, etc.
      7. DO NOT use create_graph, Graph or any complex graphing features
      8. DO NOT import any additional packages beyond manim
      9. Make sure all MathTex expressions are valid LaTeX
      10. Set the frame dimensions: config.frame_width = 12 and config.frame_height = 8
      11. Add wait(1) between animations for better pacing
      12. For text, use font_size parameter instead of scaling when possible
      13. IMPORTANT: Group related elements together and position the group
      14. Ensure ALL content stays within the frame boundaries
      
      VERY IMPORTANT: Your code must be compatible with Manim CE version 0.17.3.
      The code will fail if it uses features not in that version.`;
      
      const userPrompt = `Create a Manim animation for step ${step} with the following content:
      
      ${chunksText}
      
      Animation Style: ${animationSettings?.style || 'standard'}
      
      Return only the Python code without any additional explanation.`;
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.3, // Lower temperature for more reliable code
          max_tokens: 2000
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API error: ${response.status} - ${errorText}`);
        
        // Check if it's a model access error
        if (errorText.includes("does not exist or you do not have access to it")) {
          console.log(`Model access error for o3-mini, using fallback model instead.`);
          // Don't rethrow, we'll handle this in the catch block
          throw new Error(`Model access error: Your account doesn't have access to the requested model. Using gpt-4o instead.`);
        } else {
          throw new Error(`OpenAI API error: ${response.status}`);
        }
      }
      
      const responseData = await response.json();
      let manimCode = responseData.choices[0].message.content;
      
      // Clean up the Manim code
      manimCode = cleanManimCode(manimCode);
      
      // Add additional safeguards to the Manim code
      manimCode = addManimSafeguards(manimCode);
      
      // Fix the type issue when pushing to the array
      manimCodes.push({
        step: step as number,
        code: manimCode
      });
      
      console.log(`Generated Manim code for step ${step}, length: ${manimCode.length}`);
      
    } catch (error) {
      console.error(`Error generating Manim code for step ${step}:`, error);
      
      // Fix the type issue in the fallback code
      manimCodes.push({
        step: step as number,
        code: createFallbackManimCode(step, chunksInStep)
      });
    }
  }
  
  return manimCodes;
}

// Add this new function to improve Manim code safety
function addManimSafeguards(code) {
  // Check if the code already has the required components
  const hasScene = code.includes('class AutoScene(Scene)');
  const hasConstruct = code.includes('def construct(self)');
  const hasImport = code.includes('from manim import');
  
  let safeCode = code;
  
  // Add missing parts if needed
  if (!hasImport) {
    safeCode = 'from manim import *\n\n' + safeCode;
  }
  
  if (!hasScene) {
    // If no Scene class, wrap everything in a proper class
    safeCode = `from manim import *

class AutoScene(Scene):
    def construct(self):
        # Added safety wrapper
        ${safeCode.replace(/\n/g, '\n        ')}
`;
  } else if (!hasConstruct) {
    // If has Scene but no construct method, add it
    safeCode = safeCode.replace('class AutoScene(Scene):', 
      'class AutoScene(Scene):\n    def construct(self):');
  }
  
  // Add configuration for frame size if not present
  if (!safeCode.includes('config.frame_')) {
    safeCode = safeCode.replace('class AutoScene(Scene):', 
      'class AutoScene(Scene):\n    def __init__(self, **kwargs):\n        super().__init__(**kwargs)\n        self.camera.frame.set_width(12)\n        self.camera.frame.set_height(8)');
  }
  
  // Make sure there's a wait at the end to prevent abrupt endings
  if (!safeCode.includes('self.wait(')) {
    safeCode = safeCode.replace('def construct(self):', 
      'def construct(self):\n        # Ensure animation has proper timing\n        self.wait(1)');
  }
  
  // Fix Python syntax errors in the code
  safeCode = fixManimSyntax(safeCode);
  
  return safeCode;
}

// Function to fix common syntax errors in Manim code
function fixManimSyntax(code: string): string {
  let fixedCode = code;
  
  // Split the code into lines for processing
  const lines = fixedCode.split('\n');
  
  // Process each line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Fix "positional argument follows keyword argument" error in self.play() calls
    if (line.includes('self.play(') && line.includes('rate_func=') && !line.endsWith(',')) {
      // Extract the content inside self.play()
      const playContent = line.substring(line.indexOf('self.play(') + 10);
      const playArgs = playContent.substring(0, playContent.lastIndexOf(')'));
      
      // Split the arguments
      const args = playArgs.split(',').map(arg => arg.trim());
      
      // Separate keyword and positional arguments
      const keywordArgs: string[] = [];
      const positionalArgs: string[] = [];
      
      args.forEach(arg => {
        if (arg.includes('=')) {
          keywordArgs.push(arg);
        } else {
          positionalArgs.push(arg);
        }
      });
      
      // Reconstruct the play call with proper argument order
      // Positional arguments must come before keyword arguments
      if (positionalArgs.length > 0 && keywordArgs.length > 0) {
        const fixedPlayArgs = [...positionalArgs, ...keywordArgs].join(', ');
        lines[i] = line.replace(playArgs, fixedPlayArgs);
        console.log(`Fixed syntax error in line ${i+1}: ${line} -> ${lines[i]}`);
      }
    }
  }
  
  // Join the lines back into a single string
  return lines.join('\n');
}

// Add a fallback code generator for cases where the main generation fails
function createFallbackManimCode(step, chunks) {
  const textContent = chunks
    .filter(c => c.type === 'text')
    .map(c => c.content)
    .join('\n\n');
  
  const equationContent = chunks
    .filter(c => c.type === 'equation')
    .map(c => c.content)
    .join('\n\n');
  
  // Get a color based on the step number for variation
  const colors = ['BLUE', 'GREEN', 'TEAL', 'GOLD', 'PURPLE', 'MAROON'];
  const stepColor = colors[step % colors.length];
  
  // Escape content for embedding in f-strings
  const safeTextContent = (textContent || "Step content").replace(/"/g, '\\"').substring(0, 100);
  
  // Simple, reliable fallback code
  return `from manim import *

class AutoScene(Scene):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.camera.frame.set_width(12)
        self.camera.frame.set_height(8)
    
    def construct(self):
        # Fallback animation for step ${step}
        title = Text("Step ${step}", font_size=48)
        self.play(Write(title))
        self.wait(1)
        self.play(title.animate.scale(0.5).to_edge(UP))
        
        # Use content from the text chunks
        text = Text("${safeTextContent}...", 
                   font_size=28, 
                   line_spacing=1.5)
        text.next_to(title, DOWN, buff=0.5)
        self.play(FadeIn(text))
        
        # Add a visual element with the step-based color
        shape = Square(side_length=3) if ${step} % 2 == 0 else Circle(radius=1.5)
        shape.set_stroke(${stepColor})
        shape.next_to(text, DOWN, buff=1)
        
        self.play(Create(shape))
        self.wait(1)
        
        # Add some color
        self.play(shape.animate.set_fill(${stepColor}, opacity=0.3))
        self.wait(2)
`;
}

// Fix the executeManimCode function to better handle service errors
async function executeManimCode(
  manimCodes: ManimCodeItem[], 
  messageId: string, 
  supabase: any
): Promise<AnimationUrl[]> {
  console.log(`Starting executeManimCode with ${manimCodes.length} code blocks for message ${messageId}`);
  
  // Update the service URL to include the correct endpoint
  const manimServiceRoot = Deno.env.get('MANIM_SERVICE_URL') || "https://manim-service-589284378993.us-central1.run.app";
  console.log(`Using manim service root URL: ${manimServiceRoot}`);
  
  // Make sure the URL doesn't have a trailing slash before adding the endpoint
  const formattedServiceRoot = manimServiceRoot.endsWith('/') 
    ? manimServiceRoot.slice(0, -1) 
    : manimServiceRoot;
  
  const manimServiceUrl = `${formattedServiceRoot}/execute-manim`;
  console.log(`Final manim service endpoint URL: ${manimServiceUrl}`);
  
  const animationUrls: AnimationUrl[] = [];
  let hasSuccessfulAnimations = false;
  
  // Helper function for fetch with timeout that works in more environments
  async function fetchWithTimeout(url, options, timeout = 30000) { // Increased timeout to 30 seconds
    console.log(`Fetching URL with timeout: ${url}`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log(`Fetch timeout for URL: ${url}`);
      controller.abort();
    }, timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      console.log(`Fetch response status: ${response.status} for URL: ${url}`);
      return response;
    } catch (error) {
      console.error(`Fetch error for URL ${url}:`, error);
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // Check if service is available, but don't immediately give up if health check fails
  let serviceAvailable = true; // Default to true, we'll try anyway
  try {
    const healthCheckUrl = `${manimServiceRoot}/`;
    console.log(`Checking if Manim service is available at ${healthCheckUrl}`);
    
    const pingResponse = await fetchWithTimeout(healthCheckUrl, {
      method: 'GET'
    }, 15000); // Reduced timeout to 15 seconds for health check
    
    if (!pingResponse.ok) {
      console.warn(`Manim service health check failed (status: ${pingResponse.status})`);
      // Try to get error content for better diagnosis
      const errorContent = await pingResponse.text();
      console.warn(`Health check error content: ${errorContent}`);
      
      // If it's a 300-level redirect, we might still be able to use the service
      if (pingResponse.status >= 300 && pingResponse.status < 400) {
        console.log("Health check returned a redirect, will still attempt to use the service");
        serviceAvailable = true;
      } else if (pingResponse.status >= 400) {
        console.warn("Health check failed with client/server error, but will still try to use the service");
        // We'll still try but be cautious
      }
    } else {
      console.log("Manim service is available and healthy");
      try {
        const healthData = await pingResponse.json();
        console.log("Health check data:", JSON.stringify(healthData));
      } catch (e) {
        console.log("Could not parse health check JSON response");
      }
    }
  } catch (error) {
    console.warn(`Could not reach Manim service health endpoint: ${error}`);
    // We'll still try to use the service even if health check is completely unreachable
    console.log("Will attempt to use the service despite health check failure");
  }
  
  // Create placeholders function we can call if all else fails
  const createPlaceholders = async () => {
    console.log("Falling back to placeholder animations");
    
    // Create a map to easily find codes by step number
    const codeMap = new Map<number, string>();
    manimCodes.forEach(item => codeMap.set(item.step, item.code));
    
    // Store placeholder for each step
    for (const {step} of manimCodes) {
      try {
        // Get the code for this step from the map
        const code = codeMap.get(step);
        if (code) {
          // Store the animation code for reference
          await supabase.storage
            .from('manim-code')
            .upload(`animation_${messageId}_step${step}.py`, new Blob([code], { type: 'text/plain' }));
        }
        
        // Add a placeholder animation URL
        animationUrls.push({
          step: step,
          url: PLACEHOLDER_ANIMATION_URL
        });
      } catch (storageError) {
        console.error(`Error storing code for step ${step}:`, storageError);
        // Still add placeholder even if storage fails
        animationUrls.push({
          step: step,
          url: PLACEHOLDER_ANIMATION_URL
        });
      }
    }
    
    return animationUrls;
  };
  
  // Process each Manim code sequentially
  for (const { step, code } of manimCodes) {
    try {
      const stepFileName = `animation_${messageId}_step${step}`;
      console.log(`Executing step ${step} for message ${messageId}`);
      
      // Apply both enhancements to make the code more robust
      // First ensure color definitions are present
      const colorEnhancedCode = ensureColorDefinitions(code);
      
      // Then add safeguards for execution
      const processedCode = addManimSafeguards(colorEnhancedCode);
      
      // Store the code for this step in Supabase storage
      await supabase.storage
        .from('manim-code')
        .upload(`${stepFileName}.py`, new Blob([processedCode], { type: 'text/plain' }));
      
      // Make the actual call to the Manim service
      console.log(`Calling Manim service for step ${step}`);
      console.log(`Full request URL: ${manimServiceUrl}`);
      console.log(`Request body: ${JSON.stringify({
        code: processedCode.substring(0, 100) + '...', // Log just the beginning for debugging
        messageId,
        step
      })}`);

      let retryCount = 0;
      const maxRetries = 2;
      let executeResponse;
      let executeError;

      // Add retry logic for the main call
      while (retryCount <= maxRetries) {
        try {
          executeResponse = await fetchWithTimeout(manimServiceUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              code: processedCode,
              messageId,
              step
            })
          }, 300000); // 5-minute timeout
          
          // If we got a 300 redirect status, try to follow it
          if (executeResponse.status >= 300 && executeResponse.status < 400 && executeResponse.headers.get('location')) {
            const redirectUrl = executeResponse.headers.get('location');
            console.log(`Following redirect to: ${redirectUrl}`);
            
            // Try the redirect URL
            executeResponse = await fetchWithTimeout(redirectUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                code: processedCode,
                messageId,
                step
              })
            }, 300000); // 5-minute timeout
          }
          
          // If successful or non-retriable error, break out of retry loop
          if (executeResponse.ok || (executeResponse.status >= 400 && executeResponse.status < 500)) {
            break;
          }
          
          // If we got a 5xx error, retry
          retryCount++;
          console.log(`Retry ${retryCount}/${maxRetries} for step ${step} after server error ${executeResponse.status}`);
          await new Promise(resolve => setTimeout(resolve, 2000 * retryCount)); // Exponential backoff
        } catch (error) {
          executeError = error;
          retryCount++;
          if (retryCount <= maxRetries) {
            console.log(`Retry ${retryCount}/${maxRetries} for step ${step} after error: ${error.message}`);
            await new Promise(resolve => setTimeout(resolve, 2000 * retryCount)); // Exponential backoff
          } else {
            break;
          }
        }
      }
      
      // If we never got a valid response after retries
      if (!executeResponse || !executeResponse.ok) {
        if (executeResponse) {
          const errorText = await executeResponse.text();
          console.error(`Manim service error for step ${step} after retries: HTTP status ${executeResponse.status}, Error: ${errorText}`);
          throw new Error(`Manim service error: ${executeResponse.status} - ${errorText}`);
        } else if (executeError) {
          console.error(`Failed to call Manim service after retries: ${executeError}`);
          throw executeError;
        }
      }
      
      // Parse the response
      let result;
      try {
        const responseText = await executeResponse.text();
        console.log(`Raw response: ${responseText.substring(0, 200)}...`);
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error(`Failed to parse JSON response: ${parseError}`);
        throw new Error(`Failed to parse manim service response: ${parseError.message}`);
      }
      
      console.log(`Got parsed result for step ${step}:`, result);
      
      if (result.success === false) {
        throw new Error(result.error || 'Unknown error from Manim service');
      }
      
      // Add the animation URL to our results
      if (result.url) {
        animationUrls.push({
          step,
          url: result.url
        });
        hasSuccessfulAnimations = true;
      } else {
        throw new Error('No URL returned from Manim service');
      }
    } catch (error) {
      console.error(`Error processing step ${step}:`, error);
      // Add this step's placeholder
      animationUrls.push({
        step,
        url: PLACEHOLDER_ANIMATION_URL
      });
    }
  }
  
  // If no steps produced successful animations, fall back to complete placeholders
  if (!hasSuccessfulAnimations && animationUrls.length === 0) {
    return await createPlaceholders();
  }
  
  return animationUrls;
}

// Enhanced function to ensure color definitions and fix common syntax issues
function ensureColorDefinitions(code: string): string {
  // First apply syntax fixes
  let enhancedCode = fixManimSyntax(code);

  // Check if the code has obvious syntax errors
  const lines = enhancedCode.split('\n');
  let openParens = 0;
  let openBrackets = 0;
  let openBraces = 0;
  let inString = false;
  let stringChar = '';
  
  // Simple syntax validator
  for (const line of lines) {
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      // Skip escaped characters in strings
      if (inString && line[i-1] === '\\') continue;
      
      // Check string boundaries
      if ((char === '"' || char === "'") && !inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar && inString) {
        inString = false;
      }
      
      // Only count brackets outside strings
      if (!inString) {
        if (char === '(') openParens++;
        if (char === ')') openParens--;
        if (char === '[') openBrackets++;
        if (char === ']') openBrackets--;
        if (char === '{') openBraces++;
        if (char === '}') openBraces--;
      }
    }
  }
  
  // Fix unclosed items by appending closing characters
  let fixedCode = enhancedCode;
  while (openParens > 0) {
    fixedCode += '\n)';
    openParens--;
  }
  while (openBrackets > 0) {
    fixedCode += '\n]';
    openBrackets--;
  }
  while (openBraces > 0) {
    fixedCode += '\n}';
    openBraces--;
  }
  
  // Check if the code already has color-related elements
  const hasColorElements = 
    fixedCode.includes('RED') || 
    fixedCode.includes('BLUE') || 
    fixedCode.includes('GREEN') || 
    fixedCode.includes('color=') || 
    fixedCode.includes('set_color') ||
    fixedCode.includes('set_fill') ||
    fixedCode.includes('set_stroke');
  
  // Only add color definitions if the code doesn't seem to handle colors already
  if (!hasColorElements) {
    // Standard color definitions - use camelCase variable names to avoid conflicts
    const colorDefinitions = `
# Color definitions
colorRed = "#FF5555"
colorGreen = "#55FF55"
colorBlue = "#5555FF"
colorYellow = "#FFFF55"
colorPurple = "#AA55AA"
colorOrange = "#FFAA55"
colorWhite = "#FFFFFF"
colorBlack = "#000000"
`;

    // Check if manim is already imported
    if (!fixedCode.includes('from manim import')) {
      fixedCode = `from manim import *\n${colorDefinitions}\n${fixedCode}`;
    } else {
      // Add color definitions after imports but before class definitions
      const importEndIdx = fixedCode.lastIndexOf('import') + 
                         fixedCode.substring(fixedCode.lastIndexOf('import')).indexOf('\n');
      if (importEndIdx > 0) {
        fixedCode = fixedCode.substring(0, importEndIdx + 1) + 
                    '\n' + colorDefinitions + 
                    fixedCode.substring(importEndIdx + 1);
      }
    }
  }
  
  // Ensure the code has a Scene class
  if (!fixedCode.includes('class ') && !fixedCode.includes('def construct')) {
    // Use a more neutral color scheme in the default template
    fixedCode = `${fixedCode}

class MainScene(Scene):
    def construct(self):
        # Configure frame dimensions
        config.frame_width = 12
        config.frame_height = 8
        
        # Create a properly centered and scaled animation
        text = Text("Animation created with Manim", font_size=36)
        text.move_to(ORIGIN)  # Center the text
        
        self.play(Write(text))
        self.wait(1)
        
        # Add a simple visual element
        shape = Square(side_length=3)
        shape.next_to(text, DOWN, buff=0.5)
        self.play(Create(shape))
        self.wait(2)
`;
  }
  
  return fixedCode;
}

// Store animation in the RAG system
async function storeManimAnimation(aiResponse, manimCodes, animationUrls, supabase, messageId) {
  try {
    // Double-check all required values
    const explanation = aiResponse?.explanation || 'No explanation provided';
    const code = manimCodes?.[0]?.code || 'No code available';
    
    // Ensure there's always a valid query text
    const queryText = explanation && explanation.trim() ? 
      explanation : 'Generated animation without explanation';
    
    // Create embedding for future similarity search (only if we have valid text)
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: queryText,
        model: 'text-embedding-3-small'
      })
    });
    
    const embeddingData = await embeddingResponse.json();
    const embedding = embeddingData.data[0].embedding;
    
    // Create content hash for deduplication
    const contentHash = await createHash(queryText);
    
    // Check if a record with this hash already exists
    const { data: existingRecord } = await supabase
      .from('animation_cache')
      .select('*')
      .eq('query_hash', contentHash)
      .maybeSingle();
      
    if (existingRecord) {
      // Update existing record
      await supabase
        .from('animation_cache')
        .update({
          animation_url: animationUrls || [],
          manim_code: code,
          updated_at: new Date().toISOString()
        })
        .eq('query_hash', contentHash);
        
      console.log(`Updated existing animation record with hash ${contentHash}`);
    } else {
      // Insert new record with all required fields double-checked
      await supabase
        .from('animation_cache')
        .insert({
          query_hash: contentHash,
          query_embedding: embedding,
          animation_url: animationUrls || [],
          manim_code: code,
          original_query: queryText  // This must never be null
        });
        
      console.log(`Inserted new animation record with hash ${contentHash}`);
    }
    
    return true;
  } catch (error) {
    console.error('Error storing animation in cache:', error);
    return false;
  }
}

// Add this function to generate-animation/index.ts
async function getPlaceholderAnimation(message: any): Promise<AnimationUrl[]> {
  return [
    {
      step: 1,
      url: PLACEHOLDER_IMAGE_URL
    }
  ];
}

// Helper function to update a message with an error status
async function updateMessageWithError(supabase: any, messageId: string, errorMessage: string) {
  try {
    await supabase
      .from('chat_messages')
      .update({ 
        animation_status: 'error',
        animation_error: errorMessage
      })
      .eq('id', messageId);
    console.log(`[Background] Updated message ${messageId} with error status: ${errorMessage}`);
  } catch (updateError) {
    console.error(`[Background] Failed to update message error status: ${updateError}`);
  }
} 