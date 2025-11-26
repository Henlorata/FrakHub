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

// --- RANG DEFINÍCIÓK A SZERVEROLDALRA (Hogy ne kelljen importálni a src-ből) ---
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
    const {
      userId,
      faction_rank,
      division,
      division_rank,
      qualifications,
      is_bureau_manager,
      is_bureau_commander,
      commanded_divisions,
    } = req.body;

    if (!userId) return res.status(400).json({error: 'User ID is required'});

    // 1. Jelenlegi adatok lekérése
    const {data: currentUser, error: fetchError} = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (fetchError) throw fetchError;

    const updates: any = {};
    const notificationsToInsert = [];

    // 2. RANGVÁLTÁS ÉS AUTOMATIKUS JOGOSULTSÁG KEZELÉS
    const nextRank = faction_rank || currentUser.faction_rank;

    // Kiszámoljuk, mi legyen a system_role az (új) rang alapján
    const nextSystemRole = calculateSystemRole(nextRank);

    // Logika: Frissítjük a system_role-t, ha:
    // A) A felhasználó jelenleg 'pending' (most fogadjuk el)
    // B) A rang változott (faction_rank a body-ban van)
    // C) A jelenlegi role nem egyezik meg a ranghoz tartozó elvárt role-lal (szinkronizálás)
    if (
      currentUser.system_role === 'pending' ||
      faction_rank !== undefined ||
      currentUser.system_role !== nextSystemRole
    ) {
      updates.system_role = nextSystemRole;

      // Ha 'pending' volt, akkor üdvözlő üzenet
      if (currentUser.system_role === 'pending') {
        notificationsToInsert.push({
          user_id: userId,
          title: 'Fiók Jóváhagyva',
          message: `A fiókodat jóváhagyták ${nextRank} ranggal. Üdvözlünk az állományban!`,
          type: 'success'
        });
      }
    }

    // 3. EGYÉB ADATOK FRISSÍTÉSE
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

    // 4. ADATBÁZIS UPDATE
    if (Object.keys(updates).length > 0) {
      const {error: updateError} = await supabaseAdmin.from('profiles').update(updates).eq('id', userId);
      if (updateError) throw updateError;
    }

    // 5. ÉRTESÍTÉSEK KIKÜLDÉSE
    if (notificationsToInsert.length > 0) {
      const {error: notifError} = await supabaseAdmin.from('notifications').insert(notificationsToInsert);
      if (notifError) console.error("Notification error:", notifError);
    }

    return res.status(200).json({success: true, updates});
  } catch (err) {
    return res.status(500).json({error: (err as Error).message});
  }
}