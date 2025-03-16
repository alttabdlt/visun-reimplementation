// Script to run the SQL migration to add user_id to chat_sessions table
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get current file path in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

// Initialize Supabase client with service role key for admin privileges
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function runMigration() {
  try {
    // Read SQL file
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, 'add_user_id_to_chat_sessions.sql'),
      'utf8'
    );
    
    // Execute migration
    console.log('Running migration to add user_id to chat_sessions table...');
    const { error } = await supabase.rpc('pgexecute', { query: migrationSQL });
    
    if (error) {
      console.error('Error running migration:', error);
      return;
    }
    
    console.log('Migration completed successfully');
    
  } catch (error) {
    console.error('Error running migration:', error);
  }
}

runMigration();
