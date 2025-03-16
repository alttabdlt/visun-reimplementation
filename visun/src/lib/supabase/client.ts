import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Use hardcoded values for development - these are public keys
const supabaseUrl = 'https://xavafuqrqucwbjxxcgqk.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhdmFmdXFycXVjd2JqeHhjZ3FrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAzODE3NzMsImV4cCI6MjA1NTk1Nzc3M30.QF47UJNNPd15t5P_e4GcQ-TtatPklDnAmPYxFpTU6Y8';

export const createClient = (): ReturnType<typeof createSupabaseClient> => {
  return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
};
