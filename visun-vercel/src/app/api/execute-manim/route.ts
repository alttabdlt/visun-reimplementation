import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { put } from '@vercel/blob';
import { getServiceSupabase } from '@/lib/supabase';

const execAsync = promisify(exec);

export const config = {
  runtime: 'nodejs',
  maxDuration: 60 // 60 second timeout
};

/**
 * Executes Manim code and returns the URL to the generated animation
 */
export async function POST(request: NextRequest) {
  try {
    // Health check first
    await healthCheck();
    
    const { code, messageId } = await request.json();
    
    if (!code || !messageId) {
      return NextResponse.json({
        success: false,
        error: 'Missing required parameters: code or messageId',
        url: '/placeholder-animation.mp4'
      }, { status: 400 });
    }
    
    console.log(`Processing animation for message: ${messageId}`);
    
    // Save code to temporary file
    const tempDir = '/tmp';
    const codeFile = path.join(tempDir, `${messageId}.py`);
    fs.writeFileSync(codeFile, code);
    
    // Execute Manim
    try {
      const { stdout, stderr } = await execAsync(`python -m manim ${codeFile} -qm`);
      console.log('Manim execution stdout:', stdout);
      
      if (stderr && !stderr.includes('Rendered')) {
        console.error('Manim execution stderr:', stderr);
        throw new Error(`Manim execution error: ${stderr}`);
      }
    } catch (error) {
      console.error('Failed to execute Manim:', error);
      return NextResponse.json({
        success: false,
        error: `Failed to execute Manim: ${error.message}`,
        url: '/placeholder-animation.mp4'
      }, { status: 500 });
    }
    
    // Determine output file path (simplified, assuming output name matches input)
    const outputFile = path.join(tempDir, 'media', 'videos', path.basename(codeFile, '.py'), 'Scene.mp4');
    
    if (!fs.existsSync(outputFile)) {
      console.error('Output file not found:', outputFile);
      return NextResponse.json({
        success: false,
        error: 'Animation file not generated',
        url: '/placeholder-animation.mp4'
      }, { status: 500 });
    }
    
    // Upload to Vercel Blob Storage
    const fileBuffer = fs.readFileSync(outputFile);
    const blob = await put(`animations/${messageId}.mp4`, fileBuffer, {
      access: 'public',
      contentType: 'video/mp4'
    });
    
    // Update the message record in Supabase
    const supabase = getServiceSupabase();
    const { error: updateError } = await supabase
      .from('chat_messages')
      .update({
        animation_url: blob.url,
        animation_status: 'completed'
      })
      .eq('id', messageId);
    
    if (updateError) {
      console.error('Failed to update message record:', updateError);
    }
    
    // Clean up temporary files
    try {
      fs.unlinkSync(codeFile);
      fs.unlinkSync(outputFile);
    } catch (error) {
      console.error('Failed to clean up temporary files:', error);
    }
    
    return NextResponse.json({
      success: true,
      url: blob.url
    });
  } catch (error) {
    console.error('Error in execute-manim:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      url: '/placeholder-animation.mp4'
    }, { status: 500 });
  }
}

/**
 * Performs a health check to ensure the Manim environment is available
 */
async function healthCheck() {
  try {
    // Simple check to see if Python and Manim are installed
    const { stdout, stderr } = await execAsync('python -m manim --version');
    
    if (stderr && !stderr.includes('Manim')) {
      throw new Error(`Manim not available: ${stderr}`);
    }
    
    return true;
  } catch (error) {
    console.error('Health check failed:', error);
    throw new Error(`Health check failed: ${error.message}`);
  }
}
