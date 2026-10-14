import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true,
    watch: {
      // 忽略编辑器/AI 工具写入文件时产生的临时目录。
      // 否则 Vite 的文件监听会撞上 EBUSY: resource busy or locked 而整个崩掉。
      ignored: ['**/.*.tmpdir/**', '**/*.tmp', '**/.git/**'],
    },
    // 阶段 3 接上 Functions 后，本地用 `npm run preview:cf`（wrangler pages dev）。
    // 若想用 vite dev + 远程接口，在这里打开 proxy：
    // proxy: { '/api': { target: 'http://127.0.0.1:8788', changeOrigin: true } },
  },
  build: {
    outDir: 'dist',
    // 杂志排版首屏以文字为主，代码分割让 vendor 单独缓存
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-vue': ['vue', 'vue-router', 'pinia'],
          markdown: ['marked', 'dompurify'],
        },
      },
    },
  },
})
