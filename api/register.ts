import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// --- INLINE SUPABASE ADMIN SETUP ---
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
});

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { email, password, full_name, badge_number, faction_rank, division } = req.body;

    // 1. Validáció
    if (!email || !password || !full_name || !badge_number || !faction_rank) {
      return res.status(400).json({ error: 'Minden mező kitöltése kötelező (Név, Jelvény, Rang)!' });
    }

    if (badge_number.length !== 4 || isNaN(Number(badge_number))) {
      return res.status(400).json({ error: 'A jelvényszámnak pontosan 4 számjegyűnek kell lennie (pl. 1192).' });
    }

    // Ellenőrizzük, hogy a jelvényszám foglalt-e már
    const { data: existingBadge } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('badge_number', badge_number)
      .single();

    if (existingBadge) {
      return res.status(400).json({ error: 'Ez a jelvényszám már regisztrálva van.' });
    }

    // 2. Felhasználó létrehozása (Auth)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: { full_name: full_name }
    });

    if (authError) throw new Error(authError.message);
    if (!authData.user) throw new Error("Nem sikerült létrehozni a felhasználót.");

    // 3. Profil létrehozása
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authData.user.id,
        email: email,
        full_name: full_name,
        badge_number: badge_number,
        faction_rank: faction_rank,
        division: division || 'TSB', // Alapértelmezett a TSB
        system_role: 'pending' // Mindenki függőben kezd, adminnak kell jóváhagynia
      });

    if (profileError) {
      // Ha a profil nem jött létre, töröljük a usert, hogy ne ragadjon bent
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw new Error(`Profil hiba: ${profileError.message}`);
    }

    return res.status(200).json({ success: true, message: "Sikeres regisztráció! Várj a jóváhagyásra." });

  } catch (err) {
    const error = err as Error;
    console.error("Regisztrációs hiba:", error.message);
    return res.status(500).json({ error: error.message });
  }
}