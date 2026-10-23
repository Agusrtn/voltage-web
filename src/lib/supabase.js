import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigured = Boolean(url && key && !url.includes('your-project') && !key.includes('replace_with'))

export const supabase = supabaseConfigured
  ? createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null

export function configMessage() {
  return 'La conexión a Supabase aún no está configurada. Añade VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY para activar cuentas y datos compartidos.'
}
