import { getAdminSupabase } from '@/lib/supabase';

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

/**
 * Fetch all access tokens from Supabase (checking both access_tokens table and system_logs fallback)
 */
export async function getAllAccessTokens(): Promise<AccessToken[]> {
  const supabase = getAdminSupabase();
  const tokenMap = new Map<string, AccessToken>();

  // 1. Seed master fallback tokens
  for (const t of MASTER_FALLBACK_TOKENS) {
    tokenMap.set(t.code, t);
  }

  // 2. Try fetching from dedicated access_tokens table
  try {
    const { data, error } = await supabase
      .from('access_tokens')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      for (const row of data) {
        if (row && row.code) {
          tokenMap.set(row.code.toUpperCase(), {
            id: row.id,
            code: row.code.toUpperCase(),
            label: row.label || 'Trader Access',
            is_active: row.is_active ?? true,
            max_uses: row.max_uses ?? 10,
            used_count: row.used_count ?? 0,
            expires_at: row.expires_at || null,
            created_at: row.created_at || new Date().toISOString(),
            created_by: row.created_by || 'ADMIN',
          });
        }
      }
    }
  } catch {}

  // 3. Fetch from system_logs (persistent fallback when access_tokens table is not yet migrated in Supabase)
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
          tokenMap.set(code, {
            id: m.id || row.id,
            code: code,
            label: m.label || 'Trader Access',
            is_active: m.is_active !== undefined ? m.is_active : true,
            max_uses: m.max_uses ?? 10,
            used_count: m.used_count ?? 0,
            expires_at: m.expires_at || null,
            created_at: m.created_at || row.timestamp,
            created_by: m.created_by || 'ADMIN',
          });
        }
      }
    }
  } catch (err) {
    console.error('Failed to query tokens from system_logs:', err);
  }

  // Convert map to array and sort by created_at descending
  return Array.from(tokenMap.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
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

  const supabase = getAdminSupabase();

  // 1. Attempt to insert in access_tokens table
  try {
    const { data, error } = await supabase
      .from('access_tokens')
      .insert({
        code: tokenObj.code,
        label: tokenObj.label,
        max_uses: tokenObj.max_uses,
        expires_at: tokenObj.expires_at,
        is_active: true,
        created_by: tokenObj.created_by,
      })
      .select()
      .single();

    if (!error && data) {
      return {
        success: true,
        token: {
          id: data.id,
          code: data.code,
          label: data.label,
          is_active: data.is_active,
          max_uses: data.max_uses,
          used_count: data.used_count || 0,
          expires_at: data.expires_at,
          created_at: data.created_at,
          created_by: data.created_by,
        },
      };
    }
  } catch {}

  // 2. Persistent fallback to system_logs (guaranteed to work in current Supabase setup)
  try {
    const { data: logData, error: logErr } = await supabase
      .from('system_logs')
      .insert({
        level: 'INFO',
        source: 'ACCESS_TOKEN',
        message: `Generated Access Code: ${tokenObj.code} [${tokenObj.label}]`,
        metadata: tokenObj,
      })
      .select()
      .single();

    if (logErr) {
      return { success: false, error: logErr.message };
    }

    return { success: true, token: tokenObj };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Toggle token active status (revoke or re-activate)
 */
export async function updateAccessTokenStatus(
  idOrCode: string,
  is_active: boolean
): Promise<{ success: boolean; error?: string }> {
  const supabase = getAdminSupabase();
  const tokens = await getAllAccessTokens();
  const target = tokens.find(t => t.id === idOrCode || t.code === idOrCode.toUpperCase());

  if (!target) {
    return { success: false, error: 'Token not found' };
  }

  // 1. Try updating in access_tokens table
  try {
    const { error } = await supabase
      .from('access_tokens')
      .update({ is_active })
      .or(`id.eq.${target.id},code.eq.${target.code}`);

    if (!error) return { success: true };
  } catch {}

  // 2. Fallback to system_logs
  try {
    const updated = { ...target, is_active };
    await supabase.from('system_logs').insert({
      level: is_active ? 'INFO' : 'WARN',
      source: 'ACCESS_TOKEN',
      message: `${is_active ? 'Re-activated' : 'Revoked'} Access Code: ${target.code}`,
      metadata: updated,
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
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
    return { valid: false, message: 'This access code has been revoked by admin.' };
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
