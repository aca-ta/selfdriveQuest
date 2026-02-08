/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE ?? '/selfdriveQuest/',
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
  },
})
