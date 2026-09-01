// 把六頁打包成單一 HTML 預覽檔（給只能放一頁的地方用）。網站本身用不到。
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, frontMatter } from './render.mjs';
import { renderSite } from './render.mjs';

const p = (...a) => join(ROOT, ...a);
const read = (...a) => readFileSync(p(...a), 'utf8');

const GMAP =
  '<div class="gembed rise"><p class="gembed-note"><b>Google 地圖嵌入</b><br>' +
  '預覽環境不允許載入外部 iframe，實際網站上這裡是可縮放的 Google 地圖。<br>' +
  '<a class="btn" style="margin-top:.8rem" target="_blank" rel="noopener noreferrer" ' +
  'href="https://www.google.com/maps/search/?api=1&amp;query=%E5%98%89%E7%BE%A9%E7%B8%A3%E6%B0%B4%E4%B8%8A%E9%84%89">' +
  '在 Google 地圖開啟 →</a></p></div>';

const JS = `(function(){
  var pages=[].slice.call(document.querySelectorAll('.pv-page'));
  var tabs=[].slice.call(document.querySelectorAll('.pv-nav'));
  function go(id, anchor){
    pages.forEach(function(pg){ pg.hidden = (pg.id!==id); });
    tabs.forEach(function(t){
      if(t.dataset.go===id) t.setAttribute('aria-current','page'); else t.removeAttribute('aria-current');
    });
    var target = anchor && document.getElementById(anchor);
    (target || document.body).scrollIntoView({block:'start'});
  }
  document.addEventListener('click', function(e){
    var el = e.target.closest('[data-go]');
    if(!el) return;
    e.preventDefault();
    go(el.dataset.go, el.dataset.anchor);
  });
})();`;

const CSS = `.pv-nav,.pv-link{font:inherit; cursor:pointer; background:none; border:0; color:inherit; padding:0}
.nav .pv-nav{font-size:var(--fs-sm); font-weight:700; padding:.42rem .85rem; border-radius:999px; border:2px solid transparent}
.nav .pv-nav:hover{background:var(--sand)}
.nav .pv-nav[aria-current="page"]{background:var(--sun); border-color:var(--ink); color:#3E2B18}
.pv-link{text-decoration:underline; text-align:left}
.brand{border:0; background:none; cursor:pointer; font:inherit; color:inherit}`;

export function buildPreview(content) {
  const site = JSON.parse(read('src', 'site.json'));
  const nav = site.nav.map((x) => [x[0], x[1]]);
  const pages = renderSite(content);
  const keys = nav.map(([h]) => h.replace(/\.html$/, '')).join('|');

  const secs = [], tabs = [];
  nav.forEach(([href, label], i) => {
    const key = href.replace(/\.html$/, '');
    let main = pages[href].match(/<main id="main">\n([\s\S]*?)<\/main>\n/)[1];
    main = main.replace(/<div class="gembed rise">[\s\S]*?<\/div>/, GMAP);
    main = main.replace(new RegExp(`href="(${keys})\\.html(#map)?"`, 'g'),
      (_m, k, anchor) => `href="#" data-go="pv-${k}"${anchor ? ' data-anchor="map"' : ''}`);
    secs.push(`<section class="pv-page" id="pv-${key}"${i === 0 ? '' : ' hidden'}>\n${main}</section>`);
    tabs.push(`<button type="button" class="pv-nav" data-go="pv-${key}"${i === 0 ? ' aria-current="page"' : ''}>${label}</button>`);
  });

  const header = read('src', 'partials', 'header.html')
    .replace('{{nav}}', tabs.join(''))
    .replace('<a class="brand" href="index.html">', '<button type="button" class="brand" data-go="pv-index">')
    .replace('</span>\n    </a>', '</span>\n    </button>');
  const footer = read('src', 'partials', 'footer.html')
    .replace(/<a href="(\w+)\.html">([\s\S]*?)<\/a>/g,
      (_m, k, t) => `<button type="button" class="pv-link" data-go="pv-${k}">${t}</button>`);
  const fonts = read('src', 'layout.html').match(/<link rel="stylesheet" href="https:\/\/fonts[^>]*>/)[0];

  const out = '<meta charset="utf-8">\n<title>23.5° 剛剛好的城市</title>\n' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' + fonts + '\n' +
    '<style>\n' + read('assets', 'style.css') + '\n' + CSS + '\n</style>\n' +
    header + '<main id="main">\n' + secs.join('\n') + '\n</main>\n' + footer +
    '<script>\n' + read('assets', 'site.js') + '\n</script>\n' +
    '<script>\n' + JS + '\n</script>\n' +
    '<script>\n' + pages['assets/map-data.js'] + '\n</script>\n' +
    '<script>\n' + read('assets', 'map.js') + '\n</script>\n';
  writeFileSync(p('tools', 'preview.html'), out, 'utf8');
  return Buffer.byteLength(out);
}
