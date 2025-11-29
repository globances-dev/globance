import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('Supabase credentials are not configured');
}

export const supabase: SupabaseClient = createClient(
  supabaseUrl,
  supabaseServiceRoleKey
);

export function getSupabaseClient() {
  return supabase;
}
