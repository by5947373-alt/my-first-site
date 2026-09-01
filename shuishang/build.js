#!/usr/bin/env node
// 本機建置：node build.js
// 和線上儲存走同一支 lib/render.mjs，所以兩邊產生的頁面一定一致。
import { writeSite, mapData } from './lib/render.mjs';
import { writeFileSync } from 'node:fs';
import { buildPreview } from './lib/preview.mjs';

const files = writeSite();
for (const [f, body] of Object.entries(files)) {
  console.log('  %s %s bytes', f.padEnd(20), String(Buffer.byteLength(body)).padStart(6));
}
const n = buildPreview();
console.log('  %s %s bytes', 'tools/preview.html'.padEnd(20), String(n).padStart(6));
console.log('完成。');
