import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? '';

const validateSupabaseUrl = (value) => {
  if (!value) {
    return { valid: false, code: 'MISSING_URL' };
  }

  try {
    const parsed = new URL(value);
    const isHttp = parsed.protocol === 'https:' || parsed.protocol === 'http:';
    return isHttp ? { valid: true, code: '' } : { valid: false, code: 'INVALID_URL' };
  } catch {
    return { valid: false, code: 'INVALID_URL' };
  }
};

const urlValidation = validateSupabaseUrl(url);
const hasAnonKey = Boolean(anonKey);

export const hasSupabaseConfig = urlValidation.valid && hasAnonKey;
export const supabaseConfigError = !url
  ? 'MISSING_URL'
  : !urlValidation.valid
    ? urlValidation.code
    : !hasAnonKey
      ? 'MISSING_ANON_KEY'
      : '';

export const supabase = hasSupabaseConfig
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;
