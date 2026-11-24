export const ADMIN_EMAILS = [
  'nitinyadavtss@gmail.com',
  'letslearn9892@gmail.com'
];

export const DEFAULT_ADMIN_PASSCODE = process.env.ADMIN_PASSWORD || 'Admin@9892';

export function isAuthorizedAdminEmail(email?: string): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.map(e => e.toLowerCase()).includes(email.trim().toLowerCase());
}
