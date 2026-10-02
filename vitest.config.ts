import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/.kilo/**', '**/.next/**'],
    hookTimeout: 15000,
    testTimeout: 15000,
  },
});
