import { defineConfig } from 'vitest/config'

export default defineConfig({
  publicDir: 'data',
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    passWithNoTests: true,
  },
})
