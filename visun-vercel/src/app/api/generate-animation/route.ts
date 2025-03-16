import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import OpenAI from 'openai';

export const config = {
  runtime: 'nodejs',
  maxDuration: 60
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Generates Manim animation code from a chat message
 */
export async function POST(request: NextRequest) {
  try {
    const { messageId } = await request.json();
    
    if (!messageId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing messageId parameter' 
      }, { status: 400 });
    }
    
    console.log(`Generating animation for message: ${messageId}`);
    
    // Initialize Supabase client with service role
    const supabase = getServiceSupabase();
    
    // Update message status to processing
    await supabase
      .from('chat_messages')
      .update({ animation_status: 'processing' })
      .eq('id', messageId);
    
    // Get the message content
    const { data: message, error: messageError } = await supabase
      .from('chat_messages')
      .select('content, role')
      .eq('id', messageId)
      .single();
    
    if (messageError || !message) {
      console.error('Error fetching message:', messageError);
      await updateMessageStatus(supabase, messageId, 'error', 'Failed to retrieve message content');
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to retrieve message content' 
      }, { status: 500 });
    }
    
    // Only generate animations for assistant messages
    if (message.role !== 'assistant') {
      console.log('Skipping animation for non-assistant message');
      await updateMessageStatus(supabase, messageId, 'skipped', 'Not an assistant message');
      return NextResponse.json({ 
        success: false, 
        message: 'Skipped: Not an assistant message' 
      });
    }
    
    // Check if we should generate an animation (based on content)
    if (!shouldGenerateAnimation(message.content)) {
      console.log('No animation needed for this message');
      await updateMessageStatus(supabase, messageId, 'skipped', 'No animation required');
      return NextResponse.json({ 
        success: false, 
        message: 'Skipped: No animation required' 
      });
    }
    
    // Generate Manim code using OpenAI
    const manimCode = await generateManimCode(message.content);
    
    if (!manimCode) {
      await updateMessageStatus(supabase, messageId, 'error', 'Failed to generate Manim code');
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to generate Manim code' 
      }, { status: 500 });
    }
    
    // Store the generated code
    await supabase
      .from('animation_code')
      .insert({
        message_id: messageId,
        code: manimCode
      });
    
    // Call the execute-manim endpoint
    const executeResponse = await fetch(new URL('/api/execute-manim', request.url).toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: manimCode,
        messageId
      }),
    });
    
    if (!executeResponse.ok) {
      const errorData = await executeResponse.json();
      console.error('Execute Manim failed:', errorData);
      await updateMessageStatus(supabase, messageId, 'error', `Execution failed: ${errorData.error}`);
      return NextResponse.json({ 
        success: false, 
        error: `Animation execution failed: ${errorData.error}`,
        fallbackUrl: errorData.url
      }, { status: 500 });
    }
    
    const data = await executeResponse.json();
    
    return NextResponse.json({
      success: true,
      url: data.url,
      message: 'Animation generated successfully'
    });
  } catch (error) {
    console.error('Error in generate-animation:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}

/**
 * Updates the animation status of a message
 */
async function updateMessageStatus(supabase, messageId, status, message = null) {
  await supabase
    .from('chat_messages')
    .update({ 
      animation_status: status,
      animation_error: message
    })
    .eq('id', messageId);
}

/**
 * Determines if a message should have an animation generated
 */
function shouldGenerateAnimation(content) {
  // Skip very short messages
  if (content.length < 50) return false;
  
  // Skip messages that are clearly not suitable for animation
  const skipPhrases = [
    "I'll help you",
    "Is there anything else",
    "Let me know if you need",
    "Don't hesitate to ask",
    "Great progress",
    "Let's continue"
  ];
  
  for (const phrase of skipPhrases) {
    if (content.includes(phrase)) return false;
  }
  
  // Prioritize messages that are likely to benefit from animation
  const animationPhrases = [
    "algorithm",
    "concept",
    "visual",
    "animation",
    "demonstrate",
    "understand",
    "visualize",
    "step by step",
    "process",
    "flow",
    "physics",
    "math",
    "graph",
    "chart"
  ];
  
  for (const phrase of animationPhrases) {
    if (content.toLowerCase().includes(phrase)) return true;
  }
  
  // Default to true for assistant messages not containing skip phrases
  return true;
}

/**
 * Generates Manim code using OpenAI
 */
async function generateManimCode(messageContent) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: `You are an expert in Manim, the mathematical animation library in Python. 
          Your task is to convert a text explanation into Manim Python code that creates 
          a beautiful, clear animation illustrating the concept. 
          Create a single Scene class that runs in about 10-15 seconds.
          Focus on clarity and educational value.
          Use the Manim Community Edition syntax.
          Only output valid, runnable Python code - no explanations or comments.`
        },
        {
          role: "user",
          content: `Create a Manim animation for this explanation: ${messageContent}`
        }
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });
    
    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error generating Manim code:', error);
    return null;
  }
}
