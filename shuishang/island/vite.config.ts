import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 打包成單一個 IIFE 檔：assets/island/island.js。
// 網站其他頁面是純靜態 HTML，用一般 <script src> 載入就好，不需要 module 或額外的 CSS 檔
// （樣式以字串形式打包在 JS 裡，執行時才插入）。
export default defineConfig({
  plugins: [react()],
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    outDir: '../assets/island',
    emptyOutDir: true,
    target: 'es2019',
    lib: {
      entry: 'src/main.tsx',
      name: 'ShuishangIsland',
      formats: ['iife'],
      fileName: () => 'island.js',
    },
    chunkSizeWarningLimit: 1500,
  },
});
