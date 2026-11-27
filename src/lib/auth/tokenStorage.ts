import { getAdminSupabase } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

export interface AccessToken {
  id: string;
  code: string;
  label: string;
  is_active: boolean;
  max_uses: number;
  used_count: number;
  expires_at: string | null;
  created_at: string;
  created_by?: string;
}

export const MASTER_FALLBACK_TOKENS: AccessToken[] = [
  {
    id: 'master-algo-777',
    code: 'ALGO-MASTER-777',
    label: 'Master Admin Token',
    is_active: true,
    max_uses: 99999,
    used_count: 0,
    expires_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    created_by: 'SYSTEM',
  },
  {
    id: 'master-vip-2026',
    code: 'VIP-ACCESS-2026',
    label: 'VIP Trader Pass',
    is_active: true,
    max_uses: 500,
    used_count: 0,
    expires_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    created_by: 'SYSTEM',
  },
  {
    id: 'master-nitin-9892',
    code: 'ADMIN-NITIN-9892',
    label: 'Nitin Super Access',
    is_active: true,
    max_uses: 99999,
    used_count: 0,
    expires_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    created_by: 'SYSTEM',
  },
];

const DATA_DIR = path.join(process.cwd(), 'data');
const TOKENS_FILE = path.join(DATA_DIR, 'access_tokens.json');

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch {}
}

function loadTokensFromFile(): Map<string, AccessToken> {
  const map = new Map<string, AccessToken>();
  ensureDataDir();
  try {
    if (fs.existsSync(TOKENS_FILE)) {
      const content = fs.readFileSync(TOKENS_FILE, 'utf8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        for (const t of parsed) {
          if (t && t.code) {
            map.set(String(t.code).toUpperCase(), t);
          }
        }
      }
    }
  } catch {}
  return map;
}

function saveTokensToFile(tokens: AccessToken[]) {
  ensureDataDir();
  try {
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to write tokens to local file:', e);
  }
}

/**
 * Fetch all access tokens from local disk + Supabase (checking access_tokens table & system_logs)
 */
export async function getAllAccessTokens(): Promise<AccessToken[]> {
  const supabase = getAdminSupabase();
  const tokenMap = new Map<string, AccessToken>();

  // 1. Seed master fallback tokens
  for (const t of MASTER_FALLBACK_TOKENS) {
    tokenMap.set(t.code, { ...t });
  }

  // 2. Load from local JSON store
  const localTokens = loadTokensFromFile();
  localTokens.forEach((t, code) => {
    tokenMap.set(code, t);
  });

  // 3. Try fetching from dedicated access_tokens table in Supabase
  try {
    const { data, error } = await supabase
      .from('access_tokens')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      for (const row of data) {
        if (row && row.code) {
          const code = String(row.code).toUpperCase();
          const existing = tokenMap.get(code);
          tokenMap.set(code, {
            id: row.id || existing?.id || `tok-${code}`,
            code: code,
            label: row.label || existing?.label || 'Trader Access',
            is_active: row.is_active ?? existing?.is_active ?? true,
            max_uses: row.max_uses ?? existing?.max_uses ?? 10,
            used_count: Math.max(row.used_count ?? 0, existing?.used_count ?? 0),
            expires_at: row.expires_at || existing?.expires_at || null,
            created_at: row.created_at || existing?.created_at || new Date().toISOString(),
            created_by: row.created_by || existing?.created_by || 'ADMIN',
          });
        }
      }
    }
  } catch {}

  // 4. Fetch from system_logs (persistent fallback when access_tokens table is not yet migrated in Supabase)
  try {
    const { data: logs, error: logErr } = await supabase
      .from('system_logs')
      .select('*')
      .eq('source', 'ACCESS_TOKEN')
      .order('timestamp', { ascending: true }); // ascending so latest update overrides older ones

    if (!logErr && Array.isArray(logs)) {
      for (const row of logs) {
        if (row.metadata && row.metadata.code) {
          const m = row.metadata;
          const code = String(m.code).toUpperCase();
          const existing = tokenMap.get(code);

          // If this log event explicitly toggled is_active, respect it
          tokenMap.set(code, {
            id: m.id || existing?.id || row.id,
            code: code,
            label: m.label || existing?.label || 'Trader Access',
            is_active: m.is_active !== undefined ? m.is_active : (existing?.is_active ?? true),
            max_uses: m.max_uses ?? existing?.max_uses ?? 10,
            used_count: Math.max(m.used_count ?? 0, existing?.used_count ?? 0),
            expires_at: m.expires_at || existing?.expires_at || null,
            created_at: m.created_at || existing?.created_at || row.timestamp,
            created_by: m.created_by || existing?.created_by || 'ADMIN',
          });
        }
      }
    }
  } catch (err) {
    console.error('Failed to query tokens from system_logs:', err);
  }

  // 5. Re-apply local overrides from disk in case local was updated right now
  localTokens.forEach((t, code) => {
    const existing = tokenMap.get(code);
    if (existing) {
      existing.is_active = t.is_active; // Local active/pause status always respected
    }
  });

  const allTokens = Array.from(tokenMap.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Sync to local disk cache
  saveTokensToFile(allTokens);

  return allTokens;
}

/**
 * Creates and persists a new access token
 */
export async function createAccessToken(
  code: string,
  label: string = 'Trader Access',
  max_uses: number = 10,
  expires_in_days?: number,
  created_by?: string
): Promise<{ success: boolean; token?: AccessToken; error?: string }> {
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) {
    return { success: false, error: 'Token code is required' };
  }

  const expiresAt = expires_in_days 
    ? new Date(Date.now() + Number(expires_in_days) * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const tokenObj: AccessToken = {
    id: `tok-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    code: cleanCode,
    label: label.trim() || 'Trader Access',
    is_active: true,
    max_uses: Number(max_uses) || 10,
    used_count: 0,
    expires_at: expiresAt,
    created_at: new Date().toISOString(),
    created_by: created_by || 'ADMIN',
  };

  // 1. Immediately persist locally
  const currentTokens = await getAllAccessTokens();
  const filtered = currentTokens.filter(t => t.code !== cleanCode);
  filtered.unshift(tokenObj);
  saveTokensToFile(filtered);

  // 2. Persist in Supabase
  const supabase = getAdminSupabase();

  try {
    await supabase.from('access_tokens').insert({
      code: tokenObj.code,
      label: tokenObj.label,
      max_uses: tokenObj.max_uses,
      expires_at: tokenObj.expires_at,
      is_active: true,
      created_by: tokenObj.created_by,
    });
  } catch {}

  try {
    await supabase.from('system_logs').insert({
      level: 'INFO',
      source: 'ACCESS_TOKEN',
      message: `Generated Access Code: ${tokenObj.code} [${tokenObj.label}]`,
      metadata: tokenObj,
    });
  } catch {}

  return { success: true, token: tokenObj };
}

/**
 * Toggle token active status (revoke or re-activate)
 */
export async function updateAccessTokenStatus(
  idOrCode: string,
  is_active: boolean
): Promise<{ success: boolean; error?: string }> {
  const targetCode = idOrCode.toUpperCase().trim();
  const supabase = getAdminSupabase();
  const tokens = await getAllAccessTokens();
  const target = tokens.find(t => t.id === idOrCode || t.code === targetCode);

  if (!target) {
    return { success: false, error: 'Token not found' };
  }

  target.is_active = is_active;

  // 1. Instantly update local disk file
  saveTokensToFile(tokens);

  // 2. Try updating in access_tokens table
  try {
    await supabase
      .from('access_tokens')
      .update({ is_active })
      .or(`id.eq.${target.id},code.eq.${target.code}`);
  } catch {}

  // 3. ALWAYS insert into system_logs to guarantee global persistence across instances
  try {
    const updated = { ...target, is_active, updated_at: new Date().toISOString() };
    await supabase.from('system_logs').insert({
      level: is_active ? 'INFO' : 'WARN',
      source: 'ACCESS_TOKEN',
      message: `${is_active ? 'Re-activated' : 'Revoked/Paused'} Access Code: ${target.code}`,
      metadata: updated,
    });
  } catch (err: any) {
    console.error('Failed to log token update:', err);
  }

  return { success: true };
}

/**
 * Verifies an access code without consuming/incrementing used_count (for session active checks)
 */
export async function verifyAccessTokenStatusOnly(
  rawCode: string
): Promise<{ valid: boolean; message: string; token?: AccessToken }> {
  const cleanCode = (rawCode || '').trim().toUpperCase();
  if (!cleanCode) {
    return { valid: false, message: 'Please enter an access code' };
  }

  const tokens = await getAllAccessTokens();
  const token = tokens.find(t => t.code === cleanCode);

  if (!token) {
    return { valid: false, message: 'Invalid access code. Please contact administrator.' };
  }

  if (!token.is_active) {
    return { valid: false, message: 'This access code has been disabled or paused by the administrator.' };
  }

  if (token.expires_at && new Date(token.expires_at).getTime() < Date.now()) {
    return { valid: false, message: 'This access code has expired.' };
  }

  return {
    valid: true,
    message: 'Access code is active and valid',
    token,
  };
}

/**
 * Verifies an access code and increments used_count
 */
export async function verifyAndConsumeAccessToken(
  rawCode: string
): Promise<{ valid: boolean; message: string; token?: AccessToken }> {
  const cleanCode = (rawCode || '').trim().toUpperCase();
  if (!cleanCode) {
    return { valid: false, message: 'Please enter an access code' };
  }

  const tokens = await getAllAccessTokens();
  const token = tokens.find(t => t.code === cleanCode);

  if (!token) {
    return { valid: false, message: 'Invalid access code. Please check or contact admin.' };
  }

  if (!token.is_active) {
    return { valid: false, message: 'This access code has been disabled or paused by the administrator.' };
  }

  if (token.expires_at && new Date(token.expires_at).getTime() < Date.now()) {
    return { valid: false, message: 'This access code has expired.' };
  }

  if (token.max_uses && token.used_count >= token.max_uses) {
    return { valid: false, message: 'This access code usage limit has been reached.' };
  }

  // Increment usage count
  const supabase = getAdminSupabase();
  const newCount = (token.used_count || 0) + 1;
  token.used_count = newCount;

  // Update local file
  saveTokensToFile(tokens);

  // Try updating in access_tokens table
  try {
    await supabase
      .from('access_tokens')
      .update({ used_count: newCount })
      .or(`id.eq.${token.id},code.eq.${token.code}`);
  } catch {}

  // Update in system_logs
  try {
    const updated = { ...token, used_count: newCount };
    await supabase.from('system_logs').insert({
      level: 'INFO',
      source: 'ACCESS_TOKEN',
      message: `Used Access Code: ${token.code} (${newCount}/${token.max_uses})`,
      metadata: updated,
    });
  } catch {}

  return {
    valid: true,
    message: 'Access granted successfully',
    token: { ...token, used_count: newCount },
  };
}
