import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  test: { include: ['src/**/*.test.jsx'] },
  plugins: [react()],
  server: { host: 'localhost', port: 5173, strictPort: true },
  preview: { host: 'localhost', port: 4173, strictPort: true },
})
