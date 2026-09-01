import crypto from 'crypto';

/**
 * Perform a constant-time string comparison to prevent timing attacks
 */
export function timingSafeEqualString(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');

    if (bufA.length !== bufB.length) {
      return false;
    }

    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Compute HMAC-SHA256 signature in hex format
 */
export function computeHmacSha256(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}
