import crypto from 'node:crypto';

// Human-friendly alphabet excluding ambiguous characters:
// No 0 / O, no 1 / I / l
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

/**
 * Generate a cryptographically secure room code
 * @param length Default 4 characters
 */
export function generateRawRoomCode(length: number = 4): string {
  const chars = ROOM_CODE_ALPHABET;
  const charsLen = chars.length;
  let code = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(0, charsLen);
    code += chars[randomIndex];
  }
  return code;
}

/**
 * Generate a unique room code, retrying on collision
 * @param existsFn Function to check if code is currently active
 * @param activeCount Current number of active rooms
 */
export function generateUniqueRoomCode(
  existsFn: (code: string) => boolean,
  activeCount: number = 0
): string {
  // If active rooms exceed 50,000, dynamically bump to 5 characters
  const length = activeCount > 50000 ? 5 : 4;
  let attempts = 0;
  const maxAttempts = 20;

  while (attempts < maxAttempts) {
    const code = generateRawRoomCode(length);
    if (!existsFn(code)) {
      return code;
    }
    attempts++;
  }

  // Fallback if unexpected high collision rate
  return generateRawRoomCode(length + 1);
}

/**
 * Generate a cryptographically secure 256-bit random hex session token
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
