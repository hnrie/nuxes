import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function decodechars(values: number[]) {
  return String.fromCharCode(...values)
}

const encryptedbaseurl = [104, 116, 116, 112, 115, 58, 47, 47, 100, 105, 119, 110, 101, 115, 115, 46, 99, 108, 111, 117, 100, 47, 118, 49]
const encryptedapikey = [100, 117, 109, 109, 121]

const upstreambaseurl = decodechars(encryptedbaseurl)
const upstreamapikey = decodechars(encryptedapikey)

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
      '/api/chat/completions': {
        target: upstreambaseurl,
        changeOrigin: true,
        secure: true,
        rewrite: () => '/chat/completions',
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyreq) => {
            proxyreq.setHeader('Authorization', `Bearer ${upstreamapikey}`)
          })
        },
      },
    },
  },
})
