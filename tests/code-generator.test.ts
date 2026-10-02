import { describe, expect, it } from 'vitest';
import {
  ROOM_CODE_ALPHABET,
  generateRawRoomCode,
  generateSessionToken,
  generateUniqueRoomCode,
} from '../server/code-generator';

describe('Code Generator', () => {
  it('should generate codes with specified length', () => {
    const code = generateRawRoomCode(4);
    expect(code).toHaveLength(4);
  });

  it('should only use characters from the safe readable alphabet', () => {
    // Generate 100 codes and ensure characters belong to ROOM_CODE_ALPHABET
    for (let i = 0; i < 100; i++) {
      const code = generateRawRoomCode(2);
      for (const char of code) {
        expect(ROOM_CODE_ALPHABET.includes(char)).toBe(true);
      }
    }
  });

  it('should handle collisions and find a unique code', () => {
    const existing = new Set(['AA', 'BB', 'CC']);
    const code = generateUniqueRoomCode((c) => existing.has(c), 10);
    expect(code.length).toBeGreaterThanOrEqual(2);
    expect(existing.has(code)).toBe(false);
  });

  it('should generate high entropy 64-char hex session tokens', () => {
    const token1 = generateSessionToken();
    const token2 = generateSessionToken();
    expect(token1).toHaveLength(64);
    expect(token2).toHaveLength(64);
    expect(token1).not.toEqual(token2);
  });
});
