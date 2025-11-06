import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin, isUserAdmin } from '../lib/supabase-admin.ts';

// A segédfüggvények törölve innen

// A FŐ FUNKCIÓ
export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { targetUserId, newRole } = req.body;
  const token = req.headers.authorization?.split(' ')[1]; // "Bearer TOKEN"

  // --- BIZTONSÁGI ELLENŐRZÉS ---
  if (!token || !(await isUserAdmin(token))) { // JAVÍTVA
    return res.status(401).json({ error: 'Unauthorized: Csak admin végezheti el ezt a műveletet.' });
  }

  if (!targetUserId || !newRole) {
    return res.status(400).json({ error: 'Hiányzó adatok (targetUserId vagy newRole).' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ role: newRole })
      .eq('id', targetUserId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return res.status(200).json({ success: true, updatedProfile: data });

  } catch (err) {
    const error = err as Error;
    return res.status(500).json({ error: error.message });
  }
}