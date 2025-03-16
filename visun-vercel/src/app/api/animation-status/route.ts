import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const config = {
  runtime: 'nodejs'
};

/**
 * Checks the status of an animation by message ID
 */
export async function GET(request: NextRequest) {
  try {
    // Get messageId from query parameters
    const { searchParams } = new URL(request.url);
    const messageId = searchParams.get('messageId');
    
    if (!messageId) {
      return NextResponse.json({
        success: false,
        error: 'Missing messageId parameter'
      }, { status: 400 });
    }
    
    // Initialize Supabase client with service role
    const supabase = getServiceSupabase();
    
    // Get the message with animation status
    const { data: message, error: messageError } = await supabase
      .from('chat_messages')
      .select('animation_status, animation_url, animation_error')
      .eq('id', messageId)
      .single();
    
    if (messageError || !message) {
      console.error('Error fetching message:', messageError);
      return NextResponse.json({
        success: false,
        error: 'Failed to retrieve message'
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      status: message.animation_status,
      url: message.animation_url || null,
      error: message.animation_error || null
    });
  } catch (error: any) {
    console.error('Error in animation-status:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error occurred'
    }, { status: 500 });
  }
}
