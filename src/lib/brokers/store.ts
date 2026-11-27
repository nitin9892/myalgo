import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

export function cleanUserId(userId?: string): string {
  const raw = (userId || 'DEFAULT_TRADER').trim().toUpperCase();
  const cleaned = raw.replace(/[^A-Z0-9_-]/g, '_');
  return cleaned || 'DEFAULT_TRADER';
}

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch {}
}

export function getBrokerCredsFilePath(cleanId: string): string {
  return path.join(DATA_DIR, `broker_creds_${cleanId}.json`);
}

export function getBrokerStatusFilePath(cleanId: string): string {
  return path.join(DATA_DIR, `broker_status_${cleanId}.json`);
}

export function loadUserBrokerCreds(cleanId: string): Record<string, any> {
  ensureDataDir();
  const file = getBrokerCredsFilePath(cleanId);
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch {}
  return {};
}

export function saveUserBrokerCreds(cleanId: string, creds: Record<string, any>) {
  ensureDataDir();
  const file = getBrokerCredsFilePath(cleanId);
  try {
    fs.writeFileSync(file, JSON.stringify(creds, null, 2), 'utf8');
  } catch (err) {
    console.error(`Failed to save broker creds for ${cleanId}:`, err);
  }
}

export function loadUserBrokerStatus(cleanId: string): Record<string, any> {
  ensureDataDir();
  const file = getBrokerStatusFilePath(cleanId);
  try {
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch {}
  return {};
}

export function saveUserBrokerStatus(cleanId: string, status: Record<string, any>) {
  ensureDataDir();
  const file = getBrokerStatusFilePath(cleanId);
  try {
    fs.writeFileSync(file, JSON.stringify(status, null, 2), 'utf8');
  } catch (err) {
    console.error(`Failed to save broker status for ${cleanId}:`, err);
  }
}

export function maskCredential(val?: string): string {
  if (!val) return '';
  if (val.length <= 6) return '******';
  return val.slice(0, 4) + '****' + val.slice(-4);
}
