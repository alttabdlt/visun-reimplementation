import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import { getServiceSupabase } from '@/lib/supabase';

export const config = {
  runtime: 'nodejs',
  maxDuration: 30
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function POST(request: NextRequest) {
  try {
    const { session_id, message } = await request.json();
    
    if (!session_id || !message) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required parameters' 
      }, { status: 400 });
    }
    
    // Get previous messages for context
    const supabase = getServiceSupabase();
    const { data: previousMessages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('session_id', session_id)
      .order('created_at', { ascending: true })
      .limit(20); // Limit to recent messages for context
    
    if (messagesError) {
      console.error('Error fetching previous messages:', messagesError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch message history' 
      }, { status: 500 });
    }
    
    // Format messages for the API
    const formattedMessages = [
      {
        role: 'system',
        content: `You are an AI assistant for the Visun application. You provide clear and concise responses, 
                 explaining complex concepts in an educational way. 
                 When appropriate, you can include code snippets to illustrate your explanations.
                 Your responses will be used to generate animated visualizations, 
                 so try to include concepts that would benefit from visual representation.`
      },
      ...previousMessages.map((msg) => ({
        role: msg.role === 'user' || msg.role === 'assistant' ? msg.role : 'system',
        content: msg.content
      })),
      { role: 'user', content: message }
    ];
    
    // Get response from OpenAI
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: formattedMessages,
      temperature: 0.7,
      max_tokens: 1500,
    });
    
    const aiResponse = response.choices[0].message.content;
    
    if (!aiResponse) {
      throw new Error('Empty response from AI');
    }
    
    // Store AI response in database
    const messageId = uuidv4();
    const { error: insertError } = await supabase
      .from('chat_messages')
      .insert({
        id: messageId,
        session_id: session_id,
        role: 'assistant',
        content: aiResponse,
        created_at: new Date().toISOString(),
        animation_status: 'pending'
      });
    
    if (insertError) {
      console.error('Error inserting AI message:', insertError);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to save AI response' 
      }, { status: 500 });
    }
    
    // Update chat title if this is the first exchange
    const { data: messagesCount, error: countError } = await supabase
      .from('chat_messages')
      .select('id', { count: 'exact' })
      .eq('session_id', session_id);
    
    if (!countError && messagesCount && messagesCount.length <= 3) {
      // Generate a title from the first user message
      const chatTitle = generateChatTitle(message);
      
      // Update the chat title
      const { error: updateError } = await supabase
        .from('chat_sessions')
        .update({ title: chatTitle })
        .eq('id', session_id);
      
      if (updateError) {
        console.error('Error updating chat title:', updateError);
      }
    }
    
    // Queue animation generation
    const animationResponse = await fetch(`${request.nextUrl.origin}/api/generate-animation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messageId,
        content: aiResponse
      }),
    });
    
    if (!animationResponse.ok) {
      console.error('Error queueing animation generation:', await animationResponse.text());
    }
    
    return NextResponse.json({ 
      success: true,
      messageId,
      content: aiResponse
    });
    
  } catch (error) {
    console.error('Error in chat API:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}

// Generates a chat title based on the first user message
function generateChatTitle(message: string): string {
  // Truncate to first 40 chars or first sentence, whichever is shorter
  const firstSentence = message.split(/[.!?]/, 1)[0].trim();
  const truncated = firstSentence.length > 40 
    ? firstSentence.substring(0, 37) + '...' 
    : firstSentence;
  
  return truncated;
}
