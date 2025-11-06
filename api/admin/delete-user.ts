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

  const { targetUserId } = req.body;
  const token = req.headers.authorization?.split(' ')[1];

  // --- BIZTONSÁGI ELLENŐRZÉS ---
  if (!token || !(await isUserAdmin(token))) { // JAVÍTVA
    return res.status(401).json({ error: 'Unauthorized: Csak admin végezheti el ezt a műveletet.' });
  }

  if (!targetUserId) {
    return res.status(400).json({ error: 'Hiányzó adat (targetUserId).' });
  }

  try {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);

    if (error) {
      if (error.message.includes("Cannot delete own user")) {
        return res.status(403).json({ error: "Saját magadat nem törölheted." });
      }
      throw error;
    }

    return res.status(200).json({ success: true, deletedUserId: targetUserId });

  } catch (err) {
    const error = err as Error;
    return res.status(500).json({ error: error.message });
  }
}