import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/apollo/',
  build: { target: 'es2020' },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] }
});
