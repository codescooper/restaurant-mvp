import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/__tests__/integration/**/*.test.ts'],
    fileParallelism: false, // une seule base de test partagée → pas de parallélisme
    hookTimeout: 30000,
    testTimeout: 20000,
  },
});
