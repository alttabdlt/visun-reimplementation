// Script to create the required tables in Supabase
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function createTables() {
  try {
    // Read SQL files
    const sessionsSQL = fs.readFileSync(
      path.join(process.cwd(), 'scripts', 'create_chat_sessions_table.sql'),
      'utf8'
    );
    
    // Execute sessions table creation first
    console.log('Creating chat_sessions table...');
    const { error: sessionsError } = await supabase.rpc('pgexecute', { query: sessionsSQL });
    
    if (sessionsError) {
      console.error('Error creating chat_sessions table:', sessionsError);
      return;
    }
    
    console.log('chat_sessions table created successfully');
    
    // Read messages SQL after sessions table is created
    const messagesSQL = fs.readFileSync(
      path.join(process.cwd(), 'scripts', 'create_chat_messages_table.sql'),
      'utf8'
    );
    
    // Execute messages table creation
    console.log('Creating chat_messages table...');
    const { error: messagesError } = await supabase.rpc('pgexecute', { query: messagesSQL });
    
    if (messagesError) {
      console.error('Error creating chat_messages table:', messagesError);
      return;
    }
    
    console.log('chat_messages table created successfully');
    console.log('All tables created successfully!');
  } catch (error) {
    console.error('Error creating tables:', error);
  }
}

createTables();
