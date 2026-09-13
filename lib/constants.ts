export const APP_NAME = 'QuickDrop';
export const APP_TAGLINE = 'Phone to PC. No login. No hassle.';
export const PRIVACY_STATEMENT = 'Text is temporary and automatically deleted when your session ends.';

export const STORAGE_KEYS = {
  ROOM_CODE: 'quickdrop_room_code',
  SESSION_TOKEN: 'quickdrop_session_token',
  ROLE: 'quickdrop_role',
};

export const MAX_MESSAGE_SIZE_BYTES = 256 * 1024; // 256 KB
export const MAX_HISTORY_ITEMS = 5;

// Clean alphabet for 4-character codes (no 0, O, 1, I, l)
export const VALID_CODE_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
