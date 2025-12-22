import type {VercelRequest, VercelResponse} from '@vercel/node';
import {v2 as cloudinary} from 'cloudinary';

// Cloudinary konfigurálása a szerver oldalon
cloudinary.config({
  cloud_name: process.env.VITE_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,       // Ezt add hozzá a .env-hez!
  api_secret: process.env.CLOUDINARY_API_SECRET, // Ezt add hozzá a .env-hez!
  secure: true,
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({error: 'Method not allowed'});
  }

  const {publicId} = req.body;

  if (!publicId) {
    return res.status(400).json({error: 'Missing publicId'});
  }

  try {
    // Törlés hívása a Cloudinary Admin API-n keresztül
    const result = await cloudinary.uploader.destroy(publicId, {
      invalidate: true, // CDN cache ürítése is
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