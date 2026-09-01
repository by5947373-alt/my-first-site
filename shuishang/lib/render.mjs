// 網站渲染：CLI（build.js）和伺服器（server.js）共用同一份，
// 所以本機建置和線上儲存後重新產生的頁面一定一致。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const p = (...a) => join(ROOT, ...a);
const read = (...a) => readFileSync(p(...a), 'utf8');

const CAT_ORDER = ['taste', 'culture', 'grow'];

// 內容是後台打字進來的純文字，一律轉義後再放進 HTML。
const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const jsStr = (s) => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
const pad2 = (n) => String(n).padStart(2, '0');

export function frontMatter(text) {
  const i = text.indexOf('\n---\n');
  if (i < 0) return [{}, text];
  const meta = {};
  for (const line of text.slice(0, i).split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const c = t.indexOf(':');
    if (c < 0) throw new Error(`front-matter 這行少了冒號：${t}`);
    meta[t.slice(0, c).trim()] = t.slice(c + 1).trim();
  }
  return [meta, text.slice(i + 5)];
}

function renderVenues(items, cat) {
  return items.map((v, i) => {
    const metas = (v.meta || []).filter((m) => m.v)
      .map((m) => `<div><span class="k">${esc(m.k)}</span><span class="v">${esc(m.v)}</span></div>`).join('');
    const addr = (v.meta || []).find((m) => m.k === '地址')?.v || '';
    const gmap = addr
      ? `\n        <a class="gmap" target="_blank" rel="noopener noreferrer" ` +
        `href="https://www.google.com/maps/search/?api=1&amp;query=${escAttr(encodeURIComponent(addr.replace(/ /g, '')))}">在 Google 地圖開啟 →</a>`
      : '';
    return `      <article class="venue sticker rise" style="--acc:var(--${cat}); --acc-soft:var(--${cat}-soft)">\n` +
      `        <p class="venue-idx">NO. ${pad2(i + 1)}</p>\n` +
      `        <h3>${esc(v.name)}</h3>\n` +
      `        <p class="feat">${esc(v.feature)}</p>\n` +
      `        <p>${esc(v.text)}</p>\n` +
      `        <div class="meta">${metas}</div>${gmap}\n` +
      `      </article>`;
  }).join('\n');
}

function renderCrops(items) {
  return items.map((c) => {
    const secs = (c.sections || [])
      .map((s) => `<section><h4>${esc(s.h)}</h4><p>${esc(s.p)}</p></section>`)
      .join('\n          ');
    return `      <article class="crop sticker rise">\n` +
      `        <div class="crop-id">\n` +
      `          <span class="n">${esc(c.n)}</span>\n` +
      `          <h3>${esc(c.name)}</h3>\n` +
      `          <span class="tag">${esc(c.tag)}</span>\n` +
      `        </div>\n` +
      `        <div>\n          ${secs}\n        </div>\n` +
      `      </article>`;
  }).join('\n');
}

function renderNews(items, limit) {
  return (limit ? items.slice(0, limit) : items).map((n) => {
    const meta = esc(n.source) + (n.date ? '　·　' + esc(n.date) : '');
    return `      <a class="item sticker rise" href="${escAttr(n.url)}" target="_blank" rel="noopener noreferrer">\n` +
      `        <div class="item-top"><span class="kind ${esc(n.kind)}">${esc(n.kindLabel)}</span><span class="item-src">${meta}</span></div>\n` +
      `        <h3>${esc(n.title)}</h3>\n` +
      `        <p>${esc(n.summary)}</p>\n` +
      `        <span class="item-go">前往原文 ↗</span>\n` +
      `      </a>`;
  }).join('\n');
}

function renderBlocks(main, content) {
  return main.replace(/\{\{(venues|crops|news)(?::(\w+))?\}\}/g, (_m, kind, arg) => {
    if (kind === 'venues') {
      if (!content.venues[arg]) throw new Error(`{{venues:${arg}}} —— content.json 沒有這個分類`);
      return renderVenues(content.venues[arg], arg);
    }
    if (kind === 'crops') return renderCrops(content.crops || []);
    return renderNews(content.news || [], arg ? parseInt(arg, 10) : 0);
  });
}

export function mapData(content) {
  const rows = [];
  for (const cat of CAT_ORDER) {
    for (const v of content.venues?.[cat] || []) {
      const mp = v.map;
      if (!mp) continue;
      const meta = Object.fromEntries((v.meta || []).map((m) => [m.k, m.v]));
      const f = String(v.feature || '');
      const dot = f.indexOf(' · ');
      const q = (x) => (x ? jsStr(x) : 'null');
      rows.push(
        `  {c:${jsStr(cat)}, n:${jsStr(mp.label || v.name)}, x:${mp.x}, y:${mp.y}, ` +
        `side:${jsStr(mp.side)}, lx:${mp.lx}, ly:${mp.ly}, f:${jsStr(dot < 0 ? f : f.slice(dot + 3))},\n` +
        `   a:${q(meta['地址'])}, t:${q(meta['電話'])}, h:${q(meta['營業'])}, e:${q(meta['Email'])}}`);
    }
  }
  return '/* 由 build.js 從內容資料產生 —— 不要直接編輯。 */\n' +
    'window.SHUISHANG_SPOTS = [\n' + rows.join(',\n') + '\n];\n';
}

const navHtml = (nav, current) => nav
  .map(([href, label]) => `<a href="${href}"${href === current ? ' aria-current="page"' : ''}>${label}</a>`)
  .join('');

/** 產生所有頁面。content 省略時讀 src/content.json。回傳 {檔名: 內容}。 */
export function renderSite(content) {
  const site = JSON.parse(read('src', 'site.json'));
  content = content || JSON.parse(read('src', 'content.json'));
  const layout = read('src', 'layout.html');
  const header = read('src', 'partials', 'header.html');
  const footer = read('src', 'partials', 'footer.html');
  const nav = site.nav.map((x) => [x[0], x[1]]);
  const out = {};

  for (const [f] of nav) {
    const [meta, main] = frontMatter(read('src', 'pages', f));
    for (const k of ['title', 'desc']) {
      if (!(k in meta)) throw new Error(`${f} 的 front-matter 少了 ${k}`);
    }
    const current = (meta.nav || f.replace(/\.html$/, '')) + '.html';
    const scripts = (meta.scripts || '').split(',').map((s) => s.trim()).filter(Boolean)
      .map((s) => `<script src="${s}"></script>\n`).join('');

    const html = layout
      .replace('{{title}}', esc(meta.title))
      .replace('{{desc}}', escAttr(meta.desc))
      .replace('{{header}}', header.replace('{{nav}}', navHtml(nav, current)))
      .replace('{{main}}', renderBlocks(main, content))
      .replace('{{footer}}', footer)
      .replace('{{scripts}}', scripts);

    const left = html.match(/\{\{(\w+)\}\}/g);
    if (left) throw new Error(`${f} 還有沒填的佔位符：${[...new Set(left)].join(', ')}`);
    out[f] = html;
  }
  out['assets/map-data.js'] = mapData(content);
  return out;
}

/** 把 renderSite 的結果寫進網站根目錄。 */
export function writeSite(content) {
  const files = renderSite(content);
  for (const [f, body] of Object.entries(files)) {
    mkdirSync(dirname(p(f)), { recursive: true });
    writeFileSync(p(f), body, 'utf8');
  }
  return files;
}

export { read, p, esc, escAttr, frontMatter as _fm, renderBlocks as _blocks };
