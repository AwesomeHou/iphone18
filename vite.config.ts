import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5273,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
  },
})
