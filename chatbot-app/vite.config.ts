import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-markdown': ['react-markdown', 'remark-gfm', 'rehype-highlight'],
          'vendor-highlight': ['highlight.js'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
  server: {
    proxy: {
      '/api/ddg': {
        target: 'https://api.duckduckgo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ddg/, ''),
        secure: true,
      },
    },
  },
})
