import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabaseUrl = 'https://jfqdjqhqumoqoivjwbi.supabase.co';
const supabaseAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpmcWRqcWhxdW1vcWNvaXZqd2JpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxOTY1MDAsImV4cCI6MjA3Nzc3MjUwMH0.zLGqQ5gjH4fIdyG-K3vbOGL7dvCchbCFlnm11Txt8gs';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or anon key missing');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
