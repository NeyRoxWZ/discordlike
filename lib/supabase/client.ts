'use client';

import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

import type { Database } from '@/types/supabase';

export function getSupabaseBrowserClient() {
  return createClientComponentClient<Database>();
}
