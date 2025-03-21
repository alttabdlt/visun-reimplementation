import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Extract message ID safely from params
    const messageId = params?.id;
    
    if (!messageId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing message ID' 
      }, { status: 400 });
    }
    
    // Get the animation status from Supabase
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from('chat_messages')
      .select('animation_status, animation_url, animation_error')
      .eq('id', messageId)
      .single();
    
    if (error) {
      console.error('Error fetching animation status:', error);
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to retrieve animation status' 
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true, 
      status: data.animation_status,
      url: data.animation_url || null,
      error: data.animation_error || null
    });
    
  } catch (error) {
    console.error('Error in animation status API:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}
