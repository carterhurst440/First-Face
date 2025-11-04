// supabaseClient.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// your actual project values from Supabase
const supabaseUrl = 'https://jfqdjqhqumoqoivjwbi.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' // paste your anon key here

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or anon key missing')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

