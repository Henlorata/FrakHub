import type {VercelRequest, VercelResponse} from '@vercel/node';
import {createClient} from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({error: 'Method Not Allowed'});

  try {
    const {
      userId, system_role, faction_rank, division, division_rank, qualifications,
      is_bureau_manager, is_bureau_commander, commanded_divisions
    } = req.body;
    if (!userId) return res.status(400).json({error: 'User ID is required'});

    const {data: currentUser, error: fetchError} = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (fetchError) throw fetchError;

    const updates: any = {};
    const notificationsToInsert = [];

    if (system_role !== undefined) {
      updates.system_role = system_role;
      if (currentUser.system_role === 'pending' && system_role === 'user') {
        notificationsToInsert.push({
          user_id: userId,
          title: 'Fiók Jóváhagyva',
          message: 'A fiókodat jóváhagyták. Üdvözlünk az állományban!',
          type: 'success'
        });
      }
    }

    if (division !== undefined) {
      updates.division = division;
      if (currentUser.division !== division) {
        notificationsToInsert.push({
          user_id: userId,
          title: 'Áthelyezés',
          message: `Új osztályba kerültél: ${division}`,
          type: 'info'
        });
      }
    }

    if (division_rank !== undefined) updates.division_rank = division_rank;
    if (qualifications !== undefined) updates.qualifications = qualifications;

    // RANGVÁLTÁS (ELŐLÉPTETÉS / LEFOKOZÁS)
    if (faction_rank !== undefined) {
      updates.faction_rank = faction_rank;
      if (currentUser.faction_rank !== faction_rank) {
        updates.last_promotion_date = new Date().toISOString();
        notificationsToInsert.push({
          user_id: userId,
          title: 'Rendfokozat Változás',
          message: `Az új rendfokozatod: ${faction_rank}`,
          type: 'success'
        });
      }
    }

    if (is_bureau_manager !== undefined) updates.is_bureau_manager = is_bureau_manager;
    if (is_bureau_commander !== undefined) updates.is_bureau_commander = is_bureau_commander;
    if (commanded_divisions !== undefined) updates.commanded_divisions = commanded_divisions;

    const {error: updateError} = await supabaseAdmin.from('profiles').update(updates).eq('id', userId);
    if (updateError) throw updateError;

    if (notificationsToInsert.length > 0) {
      const {error: notifError} = await supabaseAdmin.from('notifications').insert(notificationsToInsert);
      if (notifError) console.error("Notification error:", notifError);
    }

    return res.status(200).json({success: true});
  } catch (err) {
    return res.status(500).json({error: (err as Error).message});
  }
}