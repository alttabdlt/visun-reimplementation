import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabaseTypes';

// Use environment variables if available, otherwise use hardcoded values
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://xavafuqrqucwbjxxcgqk.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhdmFmdXFycXVjd2JqeHhjZ3FrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAzODE3NzMsImV4cCI6MjA1NTk1Nzc3M30.QF47UJNNPd15t5P_e4GcQ-TtatPklDnAmPYxFpTU6Y8";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);