import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    include: ['lib/__tests__/**/*.test.ts'],
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.ts'],
      exclude: [
        'lib/__tests__/**',
        'lib/db/migrations/**',
        'lib/stores/**',
      ],
      thresholds: {
        // Global: baseline for incremental improvement
        statements: 10,
        branches: 8,
        functions: 10,
        lines: 10,
        // Per-file thresholds for critical modules
        'lib/api-handler.ts': {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80,
        },
        'lib/llm-client.ts': {
          statements: 70,
          branches: 60,
          functions: 70,
          lines: 70,
        },
        'lib/rate-limiter.ts': {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80,
        },
        'lib/validate.ts': {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
