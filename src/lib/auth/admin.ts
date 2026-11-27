import crypto from 'crypto';

export const ADMIN_EMAILS = [
  'nitinyadavtss@gmail.com',
  'letslearn9892@gmail.com'
];

export const DEFAULT_ADMIN_PASSCODE = process.env.ADMIN_PASSWORD || 'Admin@9892';
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || 'MYALGO_ADMIN_HMAC_SECRET_2026_SECURE_KEY';

export function isAuthorizedAdminEmail(email?: string): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(email.trim().toLowerCase());
}

/**
 * Creates an HMAC-SHA256 signed session token for an authenticated admin
 * Format: base64(email).timestamp.signature
 */
export function createAdminSessionToken(email: string): string {
  const cleanEmail = email.trim().toLowerCase();
  const timestamp = Date.now().toString();
  const payload = `${Buffer.from(cleanEmail).toString('base64')}.${timestamp}`;
  const hmac = crypto.createHmac('sha256', ADMIN_SESSION_SECRET).update(payload).digest('hex');
  return `${payload}.${hmac}`;
}

/**
 * Verifies an HMAC-SHA256 signed session token
 * Session is valid for 24 hours
 */
export function verifyAdminSessionToken(token?: string): { authorized: boolean; email?: string } {
  if (!token) return { authorized: false };
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return { authorized: false };
    const [b64Email, timestampStr, signature] = parts;
    const payload = `${b64Email}.${timestampStr}`;
    const expectedSig = crypto.createHmac('sha256', ADMIN_SESSION_SECRET).update(payload).digest('hex');

    // Constant-time comparison to prevent timing attacks
    if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSig, 'hex'))) {
      return { authorized: false };
    }

    const timestamp = parseInt(timestampStr, 10);
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    if (Date.now() - timestamp > maxAge || Date.now() < timestamp - 60000) {
      return { authorized: false }; // Expired or future timestamp
    }

    const email = Buffer.from(b64Email, 'base64').toString('utf8');
    if (!isAuthorizedAdminEmail(email)) {
      return { authorized: false };
    }

    return { authorized: true, email };
  } catch {
    return { authorized: false };
  }
}

/**
 * Validates request authentication strictly from:
 * 1. Authorization: Bearer <token>
 * 2. x-admin-token: <token>
 * 3. myalgo_admin_token cookie
 */
export function getAdminAuthFromRequest(request: Request): { authorized: boolean; email?: string } {
  // 1. Check Authorization Bearer header
  const authHeader = request.headers.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    const verified = verifyAdminSessionToken(token);
    if (verified.authorized) return verified;
  }

  // 2. Check x-admin-token header
  const tokenHeader = request.headers.get('x-admin-token');
  if (tokenHeader) {
    const verified = verifyAdminSessionToken(tokenHeader.trim());
    if (verified.authorized) return verified;
  }

  // 3. Check myalgo_admin_token Cookie
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/myalgo_admin_token=([^;]+)/);
  if (match) {
    const token = decodeURIComponent(match[1]);
    const verified = verifyAdminSessionToken(token);
    if (verified.authorized) return verified;
  }

  return { authorized: false };
}
