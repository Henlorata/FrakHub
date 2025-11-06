import { createClient } from '@supabase/supabase-js';

// Kiemeljük a változókat, hogy egyértelmű legyen
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

// 1. Admin kliens (SERVICE_KEY)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  // --- EZ A JAVÍTÁS ---
  // Kifejezetten megmondjuk a kliensnek, hogy minden kérésnél
  // ezt a service key-t használja az authorizációhoz,
  // ezzel 100%-ban kényszerítve az RLS (Row Level Security) megkerülését.
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  global: {
    headers: {
      Authorization: `Bearer ${supabaseServiceKey}`
    }
  }
  // --- JAVÍTÁS VÉGE ---
});

// 2. Közös segédfüggvény
export const isUserAdmin = async (token: string) => {
  // 1. Kinyerjük a felhasználót a tokenből (az admin klienssel)
  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
  if (userError || !user) {
    return false;
  }

  // 2. Lekérjük a profilját és ellenőrizzük a rangját
  // (Ehhez is az admin klienst használjuk, mivel az RLS-t ki kell kerülni)
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  return !profileError && profile && profile.role === 'lead_detective';
};