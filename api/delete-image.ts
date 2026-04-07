import type {VercelRequest, VercelResponse} from '@vercel/node';
import {v2 as cloudinary} from 'cloudinary';
import {createClient} from '@supabase/supabase-js';

cloudinary.config({
  cloud_name: process.env.VITE_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({error: 'Method not allowed'});

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({error: 'Unauthorized: Nincs token.'});

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return res.status(401).json({error: 'Unauthorized: Érvénytelen token.'});

  const {publicId} = req.body;
  if (!publicId) return res.status(400).json({error: 'Missing publicId'});

  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      invalidate: true,
      resource_type: 'image'
    });

    if (result.result !== 'ok' && result.result !== 'not found') {
      throw new Error(`Cloudinary delete failed: ${result.result}`);
    }

    return res.status(200).json({success: true, result});
  } catch (error: any) {
    console.error('Delete error:', error);
    return res.status(500).json({error: error.message});
  }
}