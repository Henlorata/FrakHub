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

// Helper: Public ID kinyerése URL-ből
const getPublicIdFromUrl = (url: string) => {
  if (!url || !url.includes('cloudinary.com')) return null;
  try {
    const parts = url.split('/upload/');
    if (parts.length < 2) return null;
    const pathPart = parts[1]; // pl: v1234/evidence/abc.jpg
    const pathWithoutVersion = pathPart.replace(/^v\d+\//, ''); // evidence/abc.jpg
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

  // 1. Supabase kliens inicializálása a felhasználó tokenjével
  // Ez azért fontos, hogy az RLS és a jogosultságok működjenek (ne törölhessen másét)
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_ANON_KEY!,
    {global: {headers: {Authorization: authHeader!}}}
  );

  try {
    // 2. Bizonyítékok lekérése TÖRLÉS ELŐTT
    const {data: evidenceList, error: fetchError} = await supabase
      .from('case_evidence')
      .select('file_path')
      .eq('case_id', caseId)
      .eq('file_type', 'image');

    if (fetchError) throw fetchError;

    // 3. Cloudinary Törlés (Ha van mit)
    if (evidenceList && evidenceList.length > 0) {
      const publicIds = evidenceList
        .map(e => getPublicIdFromUrl(e.file_path))
        .filter(id => id !== null) as string[];

      if (publicIds.length > 0) {
        await cloudinary.api.delete_resources(publicIds, {resource_type: 'image'});
      }
    }

    // 4. Adatbázis Törlés (Most már jöhet az SQL függvény)
    const {error: rpcError} = await supabase.rpc('delete_case_securely', {_case_id: caseId});

    if (rpcError) throw rpcError;

    return res.status(200).json({success: true, message: 'Akta és fájlok törölve.'});

  } catch (error: any) {
    console.error("Delete Error:", error);
    return res.status(500).json({error: error.message || 'Szerver hiba történt.'});
  }
}