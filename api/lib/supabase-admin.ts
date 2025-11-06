import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

console.log('--- supabase-admin.ts modultöltés ---');
console.log('Supabase URL (első 10 karakter):', supabaseUrl.substring(0, 10));

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  global: {
    headers: {
      Authorization: `Bearer ${supabaseServiceKey}`
    }
  }
});

console.log('--- supabaseAdmin kliens létrehozva ---');

export const isUserAdmin = async (token: string): Promise<boolean | string> => {
  console.log('--- isUserAdmin futtatása ---');
  try {
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError) {
      console.error('isUserAdmin hiba (auth.getUser):', userError.message);
      return `auth.getUser error: ${userError.message}`;
    }
    if (!user) {
      console.warn('isUserAdmin hiba: Nincs felhasználó ehhez a tokenhez');
      return "No user found for token";
    }
    console.log('isUserAdmin: Felhasználó azonosítva:', user.id);

    // --- EZ A RÉSZ OKOZZA A HIBÁT ---
    console.log('isUserAdmin: Profil lekérdezése...');
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError) {
      // EZT A HIBÁT FOGJUK KERESNI A VERCEL LOGOKBAN
      console.error('isUserAdmin hiba (profiles.select):', profileError.message);
      return `profiles.select error: ${profileError.message}`;
    }
    console.log('isUserAdmin: Profil lekérdezve:', profile);
    // --- EDDIG ---

    return profile && profile.role === 'lead_detective';

  } catch (e: any) {
    console.error('isUserAdmin GLOBÁLIS HIBA:', e.message);
    return `isUserAdmin global catch block: ${e.message}`;
  }
};