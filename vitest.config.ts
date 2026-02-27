import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
    exclude: ['**/node_modules/**', 'e2e/**'],
    // Use vite's built-in handling for TypeScript/JSX transforms
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
