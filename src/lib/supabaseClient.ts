import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase URL vagy anon key hiányzik. Kérlek, állítsd be a .env fájlban.",
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)