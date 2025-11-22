import type {VercelRequest, VercelResponse} from '@vercel/node';
import {createClient} from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({error: 'Method Not Allowed'});
  }

  try {
    const {userId} = req.body;
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({error: 'Unauthorized: No token provided.'});
    }

    const {data: {user}, error: userError} = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) return res.status(401).json({error: 'User not found'});

    const {data: adminProfile} = await supabaseAdmin
      .from('profiles')
      .select('system_role')
      .eq('id', user.id)
      .single();

    if (!adminProfile || (adminProfile.system_role !== 'admin' && adminProfile.system_role !== 'supervisor')) {
      return res.status(403).json({error: 'Nincs jogosultságod törölni felhasználót.'});
    }

    const {error: deleteError} = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) throw deleteError;

    return res.status(200).json({success: true});

  } catch (err) {
    const error = err as Error;
    console.error('Delete error:', error.message);
    return res.status(500).json({error: error.message});
  }
}