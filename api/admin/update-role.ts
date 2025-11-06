import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js'; // <-- FONTOS: Ezt az importot hozzáadjuk

// --- KÓD BEMÁSOLVA (KEZDET) ---
// A 'supabase-admin.ts' tartalma ide lett másolva, hogy elkerüljük az import hibát
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

console.log('--- update-role: modultöltés ---');
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

console.log('--- update-role: supabaseAdmin kliens létrehozva ---');

export const isUserAdmin = async (token: string): Promise<boolean | string> => {
  console.log('--- update-role: isUserAdmin futtatása ---');
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

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('isUserAdmin hiba (profiles.select):', profileError.message);
      return `profiles.select error: ${profileError.message}`;
    }
    console.log('isUserAdmin: Profil lekérdezve:', profile);

    return profile && profile.role === 'lead_detective';

  } catch (e: any) {
    console.error('isUserAdmin GLOBÁLIS HIBA:', e.message);
    return `isUserAdmin global catch block: ${e.message}`;
  }
};
// --- KÓD BEMÁSOLVA (VÉGE) ---


// A FŐ FUNKCIÓ (már használja a fenti, lokális kódot)
export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  console.log('--- update-role API hívás érkezett ---');
  try {
    if (req.method !== 'POST') {
      console.warn('Rossz metódus:', req.method);
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { targetUserId, newRole } = req.body;
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      console.warn('Admin check hiba: Nincs token');
      return res.status(401).json({ error: 'Unauthorized: No token provided.' });
    }

    console.log('Admin check indítása...');
    const adminCheckResult = await isUserAdmin(token); // A fenti kódot hívja
    console.log('Admin check eredmény:', adminCheckResult);

    if (typeof adminCheckResult === 'string') {
      console.warn('Admin check hiba:', adminCheckResult);
      return res.status(401).json({ error: `Unauthorized: Admin check failed. Reason: ${adminCheckResult}` });
    }

    if (adminCheckResult === false) {
      console.warn('Admin check hiba: A felhasználó nem admin');
      return res.status(401).json({ error: 'Unauthorized: Csak admin végezheti el ezt a műveletet.' });
    }

    console.log('Admin check sikeres, update indítása...');
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ role: newRole })
      .eq('id', targetUserId)
      .select()
      .single();

    if (error) {
      console.error('Update hiba:', error.message);
      throw error;
    }

    console.log('Update sikeres');
    return res.status(200).json({ success: true, updatedProfile: data });

  } catch (err) {
    const error = err as Error;
    console.error('update-role GLOBÁLIS HIBA:', error.message);
    return res.status(500).json({
      error: "A server error occurred inside the update-role handler",
      message: error.message
    });
  }
}