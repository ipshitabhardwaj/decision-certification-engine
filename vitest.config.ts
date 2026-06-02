import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    typecheck: {
      tsconfig: './tsconfig.test.json',
    },
  },
  resolve: {
    // Allows Vitest to resolve .js extension imports back to .ts source files
    extensions: ['.ts', '.tsx', '.js'],
  },
});