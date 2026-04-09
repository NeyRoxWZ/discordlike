import { createRouteHandlerClient, createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

import type { Database } from '@/types/supabase';

export function getSupabaseServerComponentClient() {
  return createServerComponentClient<Database>({ cookies: () => cookies() });
}

export function getSupabaseRouteHandlerClient() {
  return createRouteHandlerClient<Database>({ cookies: () => cookies() });
}
