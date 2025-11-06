import { createClient } from '@supabase/supabase-js';

// 1. Admin kliens (SERVICE_KEY)
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || '', // JAVÍTVA: VITE_ prefix eltávolítva
  process.env.SUPABASE_SERVICE_KEY || ''
);

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