import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  input: {
    popup: resolve(import.meta.dirname, 'index.html'),
    dashboard: resolve(import.meta.dirname, 'dashboard.html'),
  },
})
