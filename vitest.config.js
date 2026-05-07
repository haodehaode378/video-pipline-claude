import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['server/**/*.test.js', 'src/**/*.test.{js,jsx}'],
  },
})
