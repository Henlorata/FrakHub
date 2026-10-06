/// <reference types="vite/client" />

// Public build-time configuration. Documented in .env.example.
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** Legacy name of VITE_SUPABASE_PUBLISHABLE_KEY, still accepted. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_CLOUDINARY_CLOUD_NAME?: string;
  readonly VITE_CLOUDINARY_UPLOAD_PRESET?: string;
  readonly VITE_CLOUDINARY_AVATAR_UPLOAD_PRESET?: string;
  readonly VITE_CLOUDINARY_ACADEMY_UPLOAD_PRESET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
