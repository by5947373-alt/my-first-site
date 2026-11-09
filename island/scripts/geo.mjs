// 把 OpenStreetMap 原始資料（osm/ring.json、osm/lines.json）轉成 3D 島嶼用的幾何。
// 座標系和首頁舊版 SVG 地圖、assets/map-data.js 的圖釘一致：1000 × 625 的畫框，
// 所以後台填的圖釘 x / y（百分比）可以直接放到島上。
//
//   node scripts/geo.mjs   →  src/geo.json
//
// 資料來源：OpenStreetMap 貢獻者，ODbL 授權。
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const TOOLS = join(HERE, '..', 'osm');
const ring = JSON.parse(readFileSync(join(TOOLS, 'ring.json'), 'utf8'));
const lines = JSON.parse(readFileSync(join(TOOLS, 'lines.json'), 'utf8'));

// ── 與 tools/build_map.py 完全相同的投影 ──
const W = 1000, H = 625, PAD = 118;
const LAT0 = 23.4262;
const KX = 111.32 * Math.cos((LAT0 * Math.PI) / 180);
const KY = 110.574;
const m = (lon, lat) => [lon * KX, lat * KY];
const xs = ring.map((p) => m(...p)[0]);
const ys = ring.map((p) => m(...p)[1]);
const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
const S = (W - 2 * PAD) / (x1 - x0);
const OX = PAD - x0 * S;
const OY = H / 2 + ((y0 + y1) / 2) * S;
const P = (lon, lat) => { const [X, Y] = m(lon, lat); return [X * S + OX, OY - Y * S]; };

function dp(pts, tol) {
  if (pts.length < 3) return pts;
  const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1];
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1e-9;
  let im = 0, dm = -1;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i];
    const d = Math.abs(dy * px - dx * py + bx * ay - by * ax) / L;
    if (d > dm) { im = i; dm = d; }
  }
  if (dm > tol) return [...dp(pts.slice(0, im + 1), tol).slice(0, -1), ...dp(pts.slice(im), tol)];
  return [pts[0], pts[pts.length - 1]];
}

// 封閉環切成兩半各自簡化（起終點相同時 Douglas-Peucker 會失效）
let r = ring.map((p) => P(...p)).slice(0, -1);
const i0 = r.reduce((b, p, i) => (p[0] < r[b][0] ? i : b), 0);
r = [...r.slice(i0), ...r.slice(0, i0)];
const i1 = r.reduce((b, p, i) => (p[0] > r[b][0] ? i : b), 0);
const land = [...dp(r.slice(0, i1 + 1), 1.6).slice(0, -1), ...dp([...r.slice(i1), r[0]], 1.6).slice(0, -1)];

function inside(pt, poly) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
function distToPoly(pt, poly) {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j], [bx, by] = poly[i];
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, ((pt[0] - ax) * dx + (pt[1] - ay) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(pt[0] - ax - t * dx, pt[1] - ay - t * dy));
  }
  return best;
}

// 只保留落在島上（離岸邊至少 margin px）的連續段落
function keepInside(pts, margin) {
  const runs = []; let cur = [];
  for (const p of pts) {
    const d = distToPoly(p, land);
    if (margin < 0 ? (inside(p, land) || d <= -margin) : (inside(p, land) && d >= margin)) cur.push(p);
    else { if (cur.length > 1) runs.push(cur); cur = []; }
  }
  if (cur.length > 1) runs.push(cur);
  return runs;
}

// 把相接的 way 串成一條長線，河流和鐵路才不會斷成一節一節
function chain(segs) {
  const key = (p) => p[0].toFixed(1) + ',' + p[1].toFixed(1);
  segs = segs.map((s) => s.slice());
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < segs.length; i++) {
      for (let j = 0; j < segs.length; j++) {
        if (i === j) continue;
        const a = segs[i], b = segs[j];
        if (key(a[a.length - 1]) === key(b[0])) { segs[i] = [...a, ...b.slice(1)]; }
        else if (key(a[a.length - 1]) === key(b[b.length - 1])) { segs[i] = [...a, ...b.slice(0, -1).reverse()]; }
        else continue;
        segs.splice(j, 1); merged = true; break outer;
      }
    }
  }
  return segs;
}

const rivers = [];
const byName = {};
for (const e of lines.elements) {
  const t = e.tags || {};
  if (t.waterway !== 'river' || !e.geometry) continue;
  (byName[t.name] ||= []).push(e.geometry.map((g) => P(g.lon, g.lat)));
}
for (const [name, segs] of Object.entries(byName)) {
  for (const s of chain(segs)) {
    // 八掌溪有一大段就是鄉界，允許貼著島的邊緣流
    const runs = keepInside(s, name === '八掌溪' ? -8 : 5);
    for (const run of runs) {
      const d = dp(run, 1.2);
      const len = d.reduce((a, p, i) => (i ? a + Math.hypot(p[0] - d[i - 1][0], p[1] - d[i - 1][1]) : 0), 0);
      if (d.length > 1 && len > 25) rivers.push({ name, main: name === '八掌溪', pts: d });
    }
  }
}

const railSegs = lines.elements
  .filter((e) => e.tags?.railway === 'rail' && !e.tags?.service && e.geometry)
  .map((e) => e.geometry.map((g) => P(g.lon, g.lat)));
const rail = chain(railSegs)
  .flatMap((s) => keepInside(s, 2))
  .map((s) => dp(s, 0.8))
  .sort((a, b) => b.length - a.length)
  .slice(0, 1);

const round = (pts) => pts.map(([x, y]) => [+x.toFixed(1), +y.toFixed(1)]);
const out = {
  frame: [W, H],
  // 經緯度 → 畫框座標的投影參數（景點用真實經緯度擺放）
  proj: { KX: +KX.toFixed(6), KY, S: +S.toFixed(6), OX: +OX.toFixed(4), OY: +OY.toFixed(4) },
  tropicY: +P(120.42, 23.4534)[1].toFixed(1),
  land: round(land),
  rivers: rivers.map((r) => ({ ...r, pts: round(r.pts) })),
  rail: rail.map(round),
};
writeFileSync(join(HERE, '..', 'src', 'geo.json'), JSON.stringify(out));
console.log(`land ${land.length} pts; rivers ${rivers.length} (${rivers.map((r) => r.name + ':' + r.pts.length).join(', ')}); rail ${rail.map((r) => r.length)}`);
