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

// --- RANG DEFINÍCIÓK A SZERVEROLDALRA ---
const EXECUTIVE_STAFF = ['Commander', 'Deputy Commander'];
const COMMAND_STAFF = ['Captain III.', 'Captain II.', 'Captain I.', 'Lieutenant II.', 'Lieutenant I.'];
const SUPERVISORY_STAFF = ['Sergeant II.', 'Sergeant I.'];

const HIGH_COMMAND = [...EXECUTIVE_STAFF, ...COMMAND_STAFF];

// Segédfüggvény a jogosultság kiszámításához
const calculateSystemRole = (rank: string): 'admin' | 'supervisor' | 'user' => {
  if (HIGH_COMMAND.includes(rank)) return 'admin';
  if (SUPERVISORY_STAFF.includes(rank)) return 'supervisor';
  return 'user';
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({error: 'Method Not Allowed'});

  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({error: 'Unauthorized: No token provided.'});

    const {data: {user: authUser}, error: authError} = await supabaseAdmin.auth.getUser(token);
    if (authError || !authUser) return res.status(401).json({error: 'Invalid token.'});

    const {data: callerProfile} = await supabaseAdmin.from('profiles').select('system_role').eq('id', authUser.id).single();
    if (!callerProfile || (callerProfile.system_role !== 'admin' && callerProfile.system_role !== 'supervisor')) {
      return res.status(403).json({error: 'Nincs jogosultságod módosítani a jogosultságokat.'});
    }

    const {
      userId,
      faction_rank,
      force_rank_notification,
      division,
      division_rank,
      qualifications,
      is_bureau_manager,
      is_bureau_commander,
      commanded_divisions,
    } = req.body;

    if (!userId) return res.status(400).json({error: 'User ID is required'});

    const {data: targetUser, error: fetchError} = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (fetchError) throw fetchError;

    const updates: any = {};
    const notificationsToInsert = [];

    const nextRank = faction_rank || targetUser.faction_rank;
    const nextSystemRole = calculateSystemRole(nextRank);

    if (
      targetUser.system_role === 'pending' ||
      targetUser.system_role !== nextSystemRole ||
      force_rank_notification
    ) {
      updates.system_role = nextSystemRole;

      if (targetUser.system_role === 'pending') {
        notificationsToInsert.push({
          user_id: userId,
          title: 'Fiók Jóváhagyva',
          message: `A fiókodat jóváhagyták ${nextRank} ranggal. Üdvözlünk az állományban!`,
          type: 'success'
        });
      }
    }

    if (faction_rank !== undefined) {
      if (force_rank_notification || targetUser.faction_rank !== faction_rank) {
        updates.last_promotion_date = new Date().toISOString();
        notificationsToInsert.push({
          user_id: userId,
          title: 'Rendfokozat Változás',
          message: `Az új rendfokozatod: ${faction_rank}`,
          type: 'success'
        });
      }
      updates.faction_rank = faction_rank;
    }

    if (division !== undefined) {
      updates.division = division;
      if (targetUser.division !== division) {
        notificationsToInsert.push({
          user_id: userId, title: 'Áthelyezés', message: `Új osztályba kerültél: ${division}`, type: 'info'
        });
      }
    }

    if (division_rank !== undefined) updates.division_rank = division_rank;
    if (qualifications !== undefined) updates.qualifications = qualifications;
    if (is_bureau_manager !== undefined) updates.is_bureau_manager = is_bureau_manager;
    if (is_bureau_commander !== undefined) updates.is_bureau_commander = is_bureau_commander;
    if (commanded_divisions !== undefined) updates.commanded_divisions = commanded_divisions;

    if (Object.keys(updates).length > 0) {
      const {error: updateError} = await supabaseAdmin.from('profiles').update(updates).eq('id', userId);
      if (updateError) throw updateError;
    }

    if (notificationsToInsert.length > 0) {
      const {error: notifError} = await supabaseAdmin.from('notifications').insert(notificationsToInsert);
      if (notifError) console.error("Notification error:", notifError);
    }

    return res.status(200).json({success: true, updates});
  } catch (err) {
    console.error("Update role error:", err);
    return res.status(500).json({error: (err as Error).message});
  }
}