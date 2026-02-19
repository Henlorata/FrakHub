import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
});

const EXECUTIVE_RANKS = ['Commander', 'Deputy Commander'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { targetUserId, newPassword } = req.body;
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Unauthorized: No token provided.' });
    if (!targetUserId || !newPassword) return res.status(400).json({ error: 'Hiányzó adatok.' });

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: 'User not found' });

    const { data: adminProfile } = await supabaseAdmin
      .from('profiles')
      .select('faction_rank')
      .eq('id', user.id)
      .single();

    if (!adminProfile || !EXECUTIVE_RANKS.includes(adminProfile.faction_rank)) {
      return res.status(403).json({ error: 'Csak az Executive Staff változtathat jelszót másoknak!' });
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
      password: newPassword
    });

    if (updateError) throw updateError;

    return res.status(200).json({ success: true });

  } catch (err) {
    const error = err as Error;
    console.error('Password update error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}