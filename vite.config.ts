import { defineConfig } from 'vitest/config'

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  publicDir: 'data',
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    passWithNoTests: true,
  },
})
