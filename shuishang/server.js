// 23.5° 剛剛好的城市 —— 網站伺服器 + 內容 API。
//
// 靜態頁面仍然是真的靜態 HTML：後台按下儲存時，伺服器把內容寫進磁碟後
// 用 lib/render.mjs 重新產生所有頁面，跟本機跑 `node build.js` 是同一份程式碼。
// 開機時也會重新產生一次，所以即使容器的檔案系統是暫時的也能自我修復。
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, normalize, extname } from 'node:path';
import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { writeSite, renderSite, ROOT } from './lib/render.mjs';
import * as gh from './lib/github.mjs';

const PORT = process.env.PORT || 8080;
const DATA_DIR = process.env.DATA_DIR || join(ROOT, 'data');
const CONTENT_FILE = join(DATA_DIR, 'content.json');
const SEED_FILE = join(ROOT, 'src', 'content.json');

// 後台密碼只從環境變數來，絕不寫進程式碼。沒設就等於停用後台寫入。
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const SESSION_HOURS = 12;
const COOKIE = 'sh_admin';

// ── 自動同步回 GitHub ─────────────────────────────────────
// 每次存檔重設計時器，停手 SYNC_DELAY_MS 之後才推一次 ——
// 否則連續編輯會讓 Zeabur 一直重新部署。
let pushTimer = null, pushing = false, lastSync = null;

function schedulePush() {
  if (!gh.configured()) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(pushNow, gh.cfg.delayMs);
  lastSync = { state: 'pending', at: Date.now() + gh.cfg.delayMs };
}

async function pushNow() {
  if (!gh.configured() || pushing) return;
  pushing = true;
  clearTimeout(pushTimer);
  try {
    const files = { 'src/content.json': JSON.stringify(content, null, 2) + '\n', ...renderSite(content) };
    const n = ['taste', 'culture', 'grow'].reduce((a, c) => a + (content.venues?.[c]?.length || 0), 0);
    const msg = `後台更新內容（${n} 個據點・${content.crops?.length || 0} 項農產・${content.news?.length || 0} 則報導）`;
    const r = await gh.commitFiles(files, msg);
    lastSync = r.skipped
      ? { state: 'skipped', reason: r.skipped, at: Date.now() }
      : { state: 'ok', sha: r.sha, at: Date.now() };
    console.log(`[${new Date().toISOString()}] GitHub 同步：` +
      (r.skipped ? `略過（${r.skipped}）` : `已推送 ${r.sha}，${r.files} 個檔案`));
  } catch (e) {
    lastSync = { state: 'error', error: e.message, at: Date.now() };
    console.error(`[${new Date().toISOString()}] GitHub 同步失敗：${e.message}`);
  } finally {
    pushing = false;
  }
}

// ── 內容存取 ──────────────────────────────────────────────
let content = null;

async function loadContent() {
  await mkdir(DATA_DIR, { recursive: true });
  if (!existsSync(CONTENT_FILE)) {
    await writeFile(CONTENT_FILE, readFileSync(SEED_FILE, 'utf8'), 'utf8');
    console.log('首次啟動：已從 src/content.json 建立', CONTENT_FILE);
  }
  content = JSON.parse(await readFile(CONTENT_FILE, 'utf8'));
}

/** 只接受預期的結構，避免把任意 JSON 寫進磁碟再渲染出去。 */
function validate(c) {
  const err = (m) => { throw new Error(m); };
  const str = (v, where) => {
    if (typeof v !== 'string') err(`${where} 必須是文字`);
    if (v.length > 4000) err(`${where} 太長（上限 4000 字）`);
    return v;
  };
  if (!c || typeof c !== 'object' || Array.isArray(c)) err('內容格式不對');
  if (!c.venues || typeof c.venues !== 'object') err('缺少 venues');
  for (const cat of ['taste', 'culture', 'grow']) {
    if (!Array.isArray(c.venues[cat])) err(`venues.${cat} 必須是陣列`);
    if (c.venues[cat].length > 200) err(`venues.${cat} 筆數過多`);
    for (const [i, v] of c.venues[cat].entries()) {
      const at = `venues.${cat}[${i}]`;
      str(v.name, `${at}.name`); str(v.feature ?? '', `${at}.feature`); str(v.text ?? '', `${at}.text`);
      if (v.meta !== undefined) {
        if (!Array.isArray(v.meta)) err(`${at}.meta 必須是陣列`);
        for (const m of v.meta) { str(m.k ?? '', `${at}.meta.k`); str(m.v ?? '', `${at}.meta.v`); }
      }
      if (v.map !== undefined) {
        const m = v.map;
        if (!m || typeof m !== 'object') err(`${at}.map 格式不對`);
        for (const k of ['x', 'y', 'lx', 'ly']) {
          if (typeof m[k] !== 'number' || !Number.isFinite(m[k])) err(`${at}.map.${k} 必須是數字`);
        }
        if (m.side !== 'l' && m.side !== 'r') err(`${at}.map.side 只能是 l 或 r`);
        if (m.label !== undefined) str(m.label, `${at}.map.label`);
      }
    }
  }
  if (!Array.isArray(c.crops)) err('crops 必須是陣列');
  for (const [i, cr] of c.crops.entries()) {
    str(cr.n ?? '', `crops[${i}].n`); str(cr.name, `crops[${i}].name`); str(cr.tag ?? '', `crops[${i}].tag`);
    if (cr.sections !== undefined) {
      if (!Array.isArray(cr.sections)) err(`crops[${i}].sections 必須是陣列`);
      for (const s of cr.sections) { str(s.h ?? '', `crops[${i}].h`); str(s.p ?? '', `crops[${i}].p`); }
    }
  }
  if (!Array.isArray(c.news)) err('news 必須是陣列');
  for (const [i, n] of c.news.entries()) {
    str(n.kind ?? '', `news[${i}].kind`); str(n.kindLabel ?? '', `news[${i}].kindLabel`);
    str(n.source ?? '', `news[${i}].source`); str(n.date ?? '', `news[${i}].date`);
    str(n.title, `news[${i}].title`); str(n.summary ?? '', `news[${i}].summary`);
    const u = str(n.url ?? '', `news[${i}].url`);
    if (u && !/^https?:\/\//i.test(u)) err(`news[${i}].url 只能是 http(s) 網址`);
  }
  return c;
}

// ── 登入 ──────────────────────────────────────────────────
const failures = new Map();                       // ip -> {n, until}

function throttled(ip) {
  const f = failures.get(ip);
  return !!(f && f.until > Date.now());
}
function noteFailure(ip) {
  const f = failures.get(ip) || { n: 0, until: 0 };
  f.n += 1;
  if (f.n >= 5) { f.until = Date.now() + 5 * 60_000; f.n = 0; }
  failures.set(ip, f);
}

function sign(exp) {
  return createHmac('sha256', ADMIN_PASSWORD).update(`v1:${exp}`).digest('base64url');
}
function issueToken() {
  const exp = Date.now() + SESSION_HOURS * 3600_000;
  return `${exp}.${sign(exp)}`;
}
function validToken(tok) {
  if (!ADMIN_PASSWORD || !tok) return false;
  const dot = tok.indexOf('.');
  if (dot < 0) return false;
  const exp = Number(tok.slice(0, dot));
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const a = Buffer.from(tok.slice(dot + 1));
  const b = Buffer.from(sign(exp));
  return a.length === b.length && timingSafeEqual(a, b);
}
function checkPassword(given) {
  if (!ADMIN_PASSWORD) return false;
  const a = Buffer.from(String(given));
  const b = Buffer.from(ADMIN_PASSWORD);
  // 先比長度會洩漏長度，但這裡沒有更好的無洩漏做法；至少內容比較是定時的。
  return a.length === b.length && timingSafeEqual(a, b);
}
const cookies = (req) => Object.fromEntries(
  (req.headers.cookie || '').split(';').map((c) => {
    const i = c.indexOf('=');
    return i < 0 ? ['', ''] : [c.slice(0, i).trim(), decodeURIComponent(c.slice(i + 1))];
  }));
const isAuthed = (req) => validToken(cookies(req)[COOKIE]);
const isHttps = (req) => (req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';

// ── HTTP ─────────────────────────────────────────────────
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};
// 原始碼與資料不對外提供。
const BLOCKED = ['src/', 'data/', 'lib/', 'tools/', 'node_modules/', '.git/'];
const BLOCKED_FILES = ['server.js', 'build.js', 'package.json', 'package-lock.json', 'README.md'];

function send(res, code, body, type = 'text/plain; charset=utf-8', extra = {}) {
  res.writeHead(code, { 'content-type': type, 'x-content-type-options': 'nosniff', ...extra });
  res.end(body);
}
const json = (res, code, obj, extra) =>
  send(res, code, JSON.stringify(obj), 'application/json; charset=utf-8', extra);

function readBody(req, limit = 1_000_000) {
  return new Promise((resolve, reject) => {
    let n = 0; const chunks = [];
    req.on('data', (c) => {
      n += c.length;
      if (n > limit) { reject(new Error('內容太大')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function serveStatic(req, res, pathname) {
  let rel = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '').replace(/^\/+/, '');
  if (rel === '' ) rel = 'index.html';
  if (rel.endsWith('/')) rel += 'index.html';
  if (rel.includes('..') || BLOCKED.some((b) => rel.startsWith(b)) || BLOCKED_FILES.includes(rel))
    return send(res, 404, '找不到頁面');
  const ext = extname(rel).toLowerCase();
  if (!TYPES[ext]) return send(res, 404, '找不到頁面');
  try {
    const body = await readFile(join(ROOT, rel));
    send(res, 200, body, TYPES[ext], { 'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=3600' });
  } catch {
    send(res, 404, '找不到頁面');
  }
}

const humanDelay = (ms) => (ms < 60_000 ? `${Math.round(ms / 1000)} 秒` : `${Math.round(ms / 60_000)} 分鐘`);

const syncStatus = () => ({
  enabled: gh.configured(),
  repo: gh.configured() ? gh.cfg.repo : null,
  delayMs: gh.cfg.delayMs,
  last: lastSync,
});

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '?';

  try {
    if (url.pathname === '/api/session') {
      return json(res, 200, {
        configured: !!ADMIN_PASSWORD, authed: isAuthed(req),
        sync: isAuthed(req) ? syncStatus() : undefined,
      });
    }

    // 讓後台可以「現在就同步」，不用等計時器
    if (url.pathname === '/api/sync' && req.method === 'POST') {
      if (!isAuthed(req)) return json(res, 401, { error: '請先登入。' });
      if (!gh.configured()) return json(res, 400, { error: '伺服器沒有設定 GitHub 同步。' });
      await pushNow();
      return json(res, 200, { sync: syncStatus() });
    }

    if (url.pathname === '/api/login' && req.method === 'POST') {
      if (!ADMIN_PASSWORD)
        return json(res, 503, { error: '伺服器還沒設定 ADMIN_PASSWORD 環境變數，後台無法使用。' });
      if (throttled(ip)) return json(res, 429, { error: '嘗試太多次，請五分鐘後再試。' });
      const { password } = JSON.parse(await readBody(req, 4096) || '{}');
      if (!checkPassword(password)) { noteFailure(ip); return json(res, 401, { error: '密碼不對。' }); }
      failures.delete(ip);
      const cookie = `${COOKIE}=${issueToken()}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_HOURS * 3600}` +
        (isHttps(req) ? '; Secure' : '');
      return json(res, 200, { ok: true }, { 'set-cookie': cookie });
    }

    if (url.pathname === '/api/logout' && req.method === 'POST') {
      return json(res, 200, { ok: true }, { 'set-cookie': `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0` });
    }

    if (url.pathname === '/api/content') {
      if (req.method === 'GET') {
        if (!isAuthed(req)) return json(res, 401, { error: '請先登入。' });
        return json(res, 200, content);
      }
      if (req.method === 'PUT') {
        if (!isAuthed(req)) return json(res, 401, { error: '請先登入。' });
        let next;
        try {
          next = validate(JSON.parse(await readBody(req)));
        } catch (e) {
          return json(res, 400, { error: e.message });
        }
        const body = JSON.stringify(next, null, 2) + '\n';
        await writeFile(CONTENT_FILE, body, 'utf8');
        content = next;
        const files = writeSite(content);            // 立刻重新產生所有頁面
        console.log(`[${new Date().toISOString()}] 內容已更新，重新產生 ${Object.keys(files).length} 個檔案`);
        schedulePush();                              // 停手一段時間後同步回 GitHub
        return json(res, 200, { ok: true, files: Object.keys(files), sync: syncStatus() });
      }
      return json(res, 405, { error: '不支援的方法' });
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, '不支援的方法');
    return serveStatic(req, res, url.pathname);
  } catch (e) {
    console.error('請求處理失敗：', e);
    if (!res.headersSent) send(res, 500, '伺服器錯誤');
  }
});

await loadContent();
writeSite(content);                                  // 開機就把頁面重新產生一次
console.log(`內容：${CONTENT_FILE}`);
console.log(ADMIN_PASSWORD ? '後台：已啟用（ADMIN_PASSWORD 已設定）'
                           : '後台：唯讀（未設定 ADMIN_PASSWORD，無法登入或儲存）');
console.log(gh.configured()
  ? `GitHub 同步：已啟用 → ${gh.cfg.repo} (${gh.cfg.branch})，路徑前綴 ${gh.cfg.prefix || '(根目錄)'}，停手 ${humanDelay(gh.cfg.delayMs)}後推送`
  : 'GitHub 同步：停用（未設定 GITHUB_TOKEN / GITHUB_REPO）');

// 收到關閉訊號時，把還沒推的內容盡量推出去
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, async () => {
    console.log(`\n收到 ${sig}，關閉中…`);
    if (pushTimer) { clearTimeout(pushTimer); await pushNow().catch(() => {}); }
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`埠號 ${PORT} 已經被占用了。可能是另一個伺服器還開著。\n` +
                  `換一個埠號：PORT=8001 npm start`);
    process.exit(1);
  }
  throw e;
});
server.listen(PORT, () => console.log(`http://localhost:${PORT}`));
