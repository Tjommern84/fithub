'use server';

import {
  getAdminCandidate,
  markAdminLogin,
  type AdminAccessResult,
} from '../../../lib/adminHelper';

export async function getAdminVerificationStatus(
  accessToken: string
): Promise<AdminAccessResult> {
  return getAdminCandidate(accessToken);
}

export async function markAdminVerifiedLogin(accessToken: string): Promise<{ ok: boolean }> {
  await markAdminLogin(accessToken);
  return { ok: true };
}
