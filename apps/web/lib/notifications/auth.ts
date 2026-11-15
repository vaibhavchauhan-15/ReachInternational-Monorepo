import crypto from 'crypto';

/**
 * Validates request Bearer token against expected secret using constant-time comparison
 * to eliminate timing attack vectors.
 */
export function assertBearer(req: Request, expectedSecret: string): void {
  if (!expectedSecret) {
    throw new Error('Server configuration error: NOTIFY_SECRET is missing');
  }

  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized: Missing or malformed Bearer header');
  }

  const providedToken = authHeader.slice(7).trim();
  const tokenBuf = Buffer.from(providedToken, 'utf-8');
  const secretBuf = Buffer.from(expectedSecret, 'utf-8');

  if (tokenBuf.length !== secretBuf.length || !crypto.timingSafeEqual(tokenBuf, secretBuf)) {
    throw new Error('Unauthorized: Invalid Bearer secret');
  }
}
