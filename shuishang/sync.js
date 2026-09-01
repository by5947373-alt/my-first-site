#!/usr/bin/env node
// 把線上正在用的內容抓回 src/content.json。
//
//   SITE_URL=https://你的網域 ADMIN_PASSWORD=你的密碼 node sync.js
//   node sync.js --url http://localhost:8000 --password 你的密碼
//
// 線上編輯改的是伺服器磁碟上的 data/content.json；這支程式把它同步回版控，
// 讓 git 裡的種子檔跟線上一致。內容沒變的話不會動到檔案（結束碼 0，
// 並印出「沒有變動」，方便自動化判斷要不要 commit）。
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/render.mjs';

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : undefined;
};
const SITE_URL = (flag('url') || process.env.SITE_URL || '').replace(/\/+$/, '');
const PASSWORD = flag('password') || process.env.ADMIN_PASSWORD || '';
const DEST = join(ROOT, 'src', 'content.json');

if (!SITE_URL || !PASSWORD) {
  console.error('用法：SITE_URL=https://你的網域 ADMIN_PASSWORD=密碼 node sync.js');
  console.error('（也可以用 --url / --password 參數）');
  process.exit(2);
}

const res = await fetch(`${SITE_URL}/api/login`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ password: PASSWORD }),
});
if (!res.ok) {
  const body = await res.text().catch(() => '');
  console.error(`登入失敗（${res.status}）：${body.slice(0, 200)}`);
  process.exit(1);
}
const cookie = (res.headers.getSetCookie?.() || [])
  .map((c) => c.split(';')[0]).join('; ');
if (!cookie) { console.error('伺服器沒有回傳 session cookie。'); process.exit(1); }

const got = await fetch(`${SITE_URL}/api/content`, { headers: { cookie } });
if (!got.ok) { console.error(`讀取內容失敗（${got.status}）`); process.exit(1); }

const next = JSON.stringify(await got.json(), null, 2) + '\n';
const prev = existsSync(DEST) ? readFileSync(DEST, 'utf8') : '';

if (next === prev) {
  console.log('沒有變動 —— src/content.json 已經和線上一致。');
  process.exit(0);
}
writeFileSync(DEST, next, 'utf8');
const count = (s) => { try { const d = JSON.parse(s); return ['taste','culture','grow']
  .reduce((n,c) => n + (d.venues?.[c]?.length || 0), 0) + (d.crops?.length||0) + (d.news?.length||0); }
  catch { return '?'; } };
console.log(`已更新 src/content.json（項目數 ${count(prev)} → ${count(next)}）`);
console.log('記得跑 node build.js 讓產生的頁面也跟上，然後 commit。');
