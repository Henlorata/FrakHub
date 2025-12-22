// src/lib/cloudinary.ts

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET_EVIDENCE = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
const UPLOAD_PRESET_AVATAR = import.meta.env.VITE_CLOUDINARY_AVATAR_UPLOAD_PRESET;

/**
 * Feltöltés Cloudinary-ra
 * Egyszerűsítve: Mindig új, véletlenszerű fájlnevet kap.
 */
export const uploadToCloudinary = async (file: File, type: 'evidence' | 'avatar' = 'evidence') => {
  if (!CLOUD_NAME) throw new Error("Hiányzó Cloudinary konfiguráció (.env)");

  const preset = type === 'avatar' ? UPLOAD_PRESET_AVATAR : UPLOAD_PRESET_EVIDENCE;
  const folder = type === 'avatar' ? 'avatars' : 'evidence';

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', preset);
  formData.append('folder', folder);
  // NEM küldünk public_id-t, a Cloudinary generál egyet.

  const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Cloudinary feltöltési hiba');
  }

  const data = await response.json();
  return data.secure_url;
};

/**
 * Avatar URL optimalizáló
 * Javítottuk a transzformációt c_fill-re, ami a legstabilabb.
 */
export const getOptimizedAvatarUrl = (url: string | null | undefined, size: number = 400) => {
  if (!url) return "";
  if (!url.includes('cloudinary.com')) return url;

  // c_fill: Kitölti a rendelkezésre álló helyet (nem torzít)
  // g_face: Arcra fókuszál. Ha nincs arc, a 'g_auto' néha hibázik, ezért a 'g_face' jobb itt,
  // vagy használhatunk 'g_center'-t fallbacknek, de a Cloudinary okos.
  const transformation = `c_fill,g_face,w_${size},h_${size},q_auto,f_auto`;

  const parts = url.split('/upload/');
  if (parts.length === 2) {
    return `${parts[0]}/upload/${transformation}/${parts[1]}`;
  }
  return url;
};

export const getPublicIdFromUrl = (url: string | null) => {
  if (!url || !url.includes('cloudinary.com')) return null;

  try {
    // URL szétszedése
    const parts = url.split('/upload/');
    if (parts.length < 2) return null;

    const pathPart = parts[1]; // pl: v12345678/avatars/filename.jpg

    // Verziószám (v123...) levágása, ha van
    const pathWithoutVersion = pathPart.replace(/^v\d+\//, '');

    // Kiterjesztés (.jpg) levágása
    const publicId = pathWithoutVersion.substring(0, pathWithoutVersion.lastIndexOf('.'));

    return publicId;
  } catch (e) {
    console.error("Error parsing public ID:", e);
    return null;
  }
};