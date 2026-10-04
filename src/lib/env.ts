/** Public build-time configuration (VITE_* variables, inlined by Vite). See .env.example. */
export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL ?? "",
  supabaseKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || "",
  cloudinary: {
    cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME ?? "",
    presets: {
      evidence: import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET ?? "",
      avatar: import.meta.env.VITE_CLOUDINARY_AVATAR_UPLOAD_PRESET ?? "",
      academy: import.meta.env.VITE_CLOUDINARY_ACADEMY_UPLOAD_PRESET ?? "",
    },
  },
};

/** Variables without which the app cannot start at all. */
export const missingRequiredEnv: string[] = [
  !env.supabaseUrl && "VITE_SUPABASE_URL",
  !env.supabaseKey && "VITE_SUPABASE_PUBLISHABLE_KEY (vagy VITE_SUPABASE_ANON_KEY)",
].filter((name): name is string => typeof name === "string");
