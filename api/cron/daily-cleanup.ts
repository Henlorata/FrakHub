import type {VercelRequest, VercelResponse} from '@vercel/node';
import {createClient} from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("HIBA: Hiányzó Supabase URL vagy Service Key!");
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {autoRefreshToken: false, persistSession: false}
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const results = {
    financeDeleted: 0,
    vehicleDeleted: 0,
    actionsDeleted: 0,
    errors: [] as string[]
  };

  try {
    console.log("--- Napi karbantartás indítása ---");

    try {
      const financeThreshold = new Date();
      financeThreshold.setDate(financeThreshold.getDate() - 40);

      const {data: oldRequests, error: fetchError} = await supabaseAdmin
        .from('budget_requests')
        .select('id, proof_image_path')
        .neq('status', 'pending')
        .lt('created_at', financeThreshold.toISOString());

      if (fetchError) throw fetchError;

      if (oldRequests && oldRequests.length > 0) {
        const filePaths = oldRequests.map(req => req.proof_image_path).filter(Boolean);
        if (filePaths.length > 0) {
          await supabaseAdmin.storage.from('finance_proofs').remove(filePaths);
        }
        const idsToDelete = oldRequests.map(req => req.id);
        await supabaseAdmin.from('budget_requests').delete().in('id', idsToDelete);
        results.financeDeleted = idsToDelete.length;
        console.log(`Pénzügy: ${idsToDelete.length} régi elem törölve.`);
      }
    } catch (err: any) {
      console.error("Pénzügyi takarítás hiba:", err.message);
      results.errors.push(`Finance error: ${err.message}`);
    }

    try {
      const vehicleThreshold = new Date();
      vehicleThreshold.setDate(vehicleThreshold.getDate() - 40);

      const {error: vehicleError, count} = await supabaseAdmin
        .from('vehicle_requests')
        .delete({count: 'exact'})
        .neq('status', 'pending')
        .lt('created_at', vehicleThreshold.toISOString());

      if (vehicleError) throw vehicleError;
      results.vehicleDeleted = count || 0;
      console.log(`Jármű: ${count} régi elem törölve.`);

    } catch (err: any) {
      console.error("Jármű takarítás hiba:", err.message);
      results.errors.push(`Vehicle error: ${err.message}`);
    }

    try {
      const actionThreshold = new Date();
      actionThreshold.setDate(actionThreshold.getDate() - 1);

      const {error: actionDeleteError, count} = await supabaseAdmin
        .from('action_logs')
        .delete({count: 'exact'})
        .lt('created_at', actionThreshold.toISOString());

      if (actionDeleteError) throw actionDeleteError;
      results.actionsDeleted = count || 0;
      console.log(`Action Log: ${count} régi bejegyzés törölve.`);

    } catch (err: any) {
      console.error("Action log takarítás hiba:", err.message);
      results.errors.push(`Action log error: ${err.message}`);
    }

    return res.status(200).json({
      success: results.errors.length === 0,
      message: "Karbantartás lefutott.",
      timestamp: new Date().toISOString(),
      results
    });

  } catch (err: any) {
    console.error("Kritikus hiba:", err.message);
    return res.status(500).json({error: err.message});
  }
}