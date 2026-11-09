import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 獨立網站：npm run build 輸出到 dist/，整個資料夾放到任何靜態主機就能用。
// base 用相對路徑，放在子目錄（例如 GitHub Pages 的 /my-first-site/island/）也不會壞。
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2019',
    chunkSizeWarningLimit: 1500,
  },
});
