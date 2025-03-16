import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export const createServerClient = () => {
  const cookieStore = cookies();
  
  return createClient(
    'https://xavafuqrqucwbjxxcgqk.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhdmFmdXFycXVjd2JqeHhjZ3FrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAzODE3NzMsImV4cCI6MjA1NTk1Nzc3M30.QF47UJNNPd15t5P_e4GcQ-TtatPklDnAmPYxFpTU6Y8',
    {
      auth: {
        persistSession: false,
      },
    }
  );
};
