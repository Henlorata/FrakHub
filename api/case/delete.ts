import type {VercelRequest, VercelResponse} from '@vercel/node';
import {createClient} from '@supabase/supabase-js';
import {v2 as cloudinary} from 'cloudinary';

// Cloudinary Config
cloudinary.config({
  cloud_name: process.env.VITE_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const getPublicIdFromUrl = (url: string) => {
  if (!url || !url.includes('cloudinary.com')) return null;
  try {
    const parts = url.split('/upload/');
    if (parts.length < 2) return null;
    const pathPart = parts[1];
    const pathWithoutVersion = pathPart.replace(/^v\d+\//, '');
    const publicId = pathWithoutVersion.substring(0, pathWithoutVersion.lastIndexOf('.'));
    return publicId;
  } catch (e) {
    return null;
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({error: 'Method not allowed'});

  const {caseId} = req.body;
  const authHeader = req.headers.authorization;

  if (!caseId) return res.status(400).json({error: 'Hiányzó Case ID'});

  const supabaseUserClient = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!,
    {global: {headers: {Authorization: authHeader!}}}
  );

  const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  try {
    const {data: {user}, error: authError} = await supabaseUserClient.auth.getUser();
    if (authError || !user) return res.status(401).json({error: "Nem vagy bejelentkezve."});

    const {data: profile} = await supabaseAdmin.from('profiles').select('*').eq('id', user.id).single();
    const {data: caseData} = await supabaseAdmin.from('cases').select('owner_id').eq('id', caseId).single();

    if (!profile || !caseData) return res.status(404).json({error: "Adatok nem találhatók."});

    const isOwner = caseData.owner_id === user.id;
    const isManager = profile.is_bureau_manager;
    const isCommander = profile.division === 'MCB' && profile.is_bureau_commander;

    if (!isOwner && !isManager && !isCommander) {
      return res.status(403).json({error: "Nincs jogosultságod törölni ezt az aktát."});
    }

    console.log(`[DELETE] Authorized delete for case: ${caseId} by user: ${user.id}`);

    // --- TÖRLÉSI FOLYAMAT  ---

    const {data: evidenceList} = await supabaseAdmin
      .from('case_evidence')
      .select('file_path')
      .eq('case_id', caseId);

    // Cloudinary és Storage
    const cloudinaryIds: string[] = [];
    const supabasePaths: string[] = [];

    if (evidenceList && evidenceList.length > 0) {
      evidenceList.forEach(item => {
        if (item.file_path && item.file_path.includes('cloudinary.com')) {
          const pubId = getPublicIdFromUrl(item.file_path);
          if (pubId) cloudinaryIds.push(pubId);
        } else if (item.file_path) {
          supabasePaths.push(item.file_path);
        }
      });
    }

    if (cloudinaryIds.length > 0) {
      await cloudinary.api.delete_resources(cloudinaryIds, {resource_type: 'image'});
    }

    if (supabasePaths.length > 0) {
      await supabaseAdmin.storage.from('case_evidence').remove(supabasePaths);
    }

    // ADATBÁZIS TÖRLÉS
    await Promise.all([
      supabaseAdmin.from('case_evidence').delete().eq('case_id', caseId),
      supabaseAdmin.from('case_notes').delete().eq('case_id', caseId),
      supabaseAdmin.from('case_suspects').delete().eq('case_id', caseId),
      supabaseAdmin.from('case_collaborators').delete().eq('case_id', caseId),
      supabaseAdmin.from('case_warrants').delete().eq('case_id', caseId),
      supabaseAdmin.from('action_logs').delete().eq('case_id', caseId)
    ]);

    const {error: dbError} = await supabaseAdmin.from('cases').delete().eq('id', caseId);

    if (dbError) {
      console.error("[DELETE ERROR]", dbError);
      throw new Error("Az akta törlése az adatbázisból sikertelen: " + dbError.message);
    }

    return res.status(200).json({success: true, message: 'Akta és minden adat véglegesen törölve.'});

  } catch (error: any) {
    console.error("[DELETE CRITICAL ERROR]:", error);
    return res.status(500).json({error: error.message || 'Szerver hiba történt.'});
  }
}