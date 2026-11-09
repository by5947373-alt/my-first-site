// 一次算好島上所有東西的位置：道路曲線、農田、樹、房子、丘陵。
// 用固定種子的亂數，每次載入長得都一樣；景點周圍會自動空出來。
import * as THREE from 'three';
import { BOUNDS, LAND, RAIL, RIVERS, curveOf, distToLine, onLand, rng, toWorld, type V2 } from './geo';
import { ROADS_PX, type Poi } from './data';

export interface Field { x: number; z: number; w: number; d: number; r: number; color: string; kind: 'crop' | 'rice' | 'herb' | 'pond' | 'plain' }
export interface Tree { x: number; z: number; s: number; kind: 0 | 1 | 2; tone: number }
export interface HouseSpot { x: number; z: number; w: number; d: number; h: number; r: number; roof: number; wall: number }
export interface Hill { x: number; z: number; r: number; h: number; tone: number }

export interface World {
  roads: { name: string; main: boolean; pts: V2[]; curve: THREE.CatmullRomCurve3 }[];
  rivers: { name: string; main: boolean; pts: V2[]; curve: THREE.CatmullRomCurve3 }[];
  rail: THREE.CatmullRomCurve3 | null;
  fields: Field[];
  trees: Tree[];
  houses: HouseSpot[];
  hills: Hill[];
  /** 草地上的小花叢 */
  flowers: { x: number; z: number; c: number; s: number }[];
  /** 主要道路旁的路燈 */
  lamps: { x: number; z: number }[];
  /** 地面高度（丘陵上會高一點） */
  groundY: (x: number, z: number) => number;
}

const FIELD_COLORS: [string, Field['kind'], number][] = [
  ['#A9DB7E', 'crop', 26], ['#93D06F', 'crop', 20], ['#F2D46B', 'rice', 14], ['#F6DE95', 'plain', 9],
  ['#6DB25C', 'herb', 12], ['#7FD3CF', 'pond', 9], ['#C2E48F', 'plain', 10],
];

export function buildWorld(pois: Poi[]): World {
  const R = rng(235);
  const roads = ROADS_PX.map((r) => {
    const pts = r.pts.map(toWorld);
    return { name: r.name, main: !!r.main, pts, curve: curveOf(pts, 0) };
  });
  const rivers = RIVERS.map((r) => ({ ...r, curve: curveOf(r.pts, 0) }));
  const rail = RAIL.length > 1 ? curveOf(RAIL, 0, false, 0.2) : null;

  // 道路取樣點（距離判斷用）
  const roadPts = roads.map((r) => r.curve.getSpacedPoints(Math.ceil(r.curve.getLength() / 0.3)).map((v) => [v.x, v.z] as V2));
  const near = (p: V2, lines: V2[][], d: number) => lines.some((l) => distToLine(p, l) < d);
  const riverLines = rivers.map((r) => r.pts);
  const poiNear = (p: V2, d: number) => pois.some((q) => Math.hypot(q.pos[0] - p[0], q.pos[1] - p[1]) < d);

  const town = [toWorld([378, 285]), toWorld([300, 380])];
  const inTown = (p: V2) => Math.hypot(p[0] - town[0][0], p[1] - town[0][1]) < 2.9 || Math.hypot(p[0] - town[1][0], p[1] - town[1][1]) < 1.5;

  // ── 丘陵：水上東側（中庄、忠和一帶）是緩坡丘陵 ──
  const hills: Hill[] = [];
  for (const [px, r, h] of [[[722, 300], 1.3, 0.55], [[790, 300], 1.1, 0.5], [[815, 345], 0.9, 0.42], [[748, 430], 1.0, 0.45],
    [[842, 462], 0.8, 0.38], [[650, 312], 0.8, 0.32], [[690, 410], 0.7, 0.3]] as [V2, number, number][]) {
    const p = toWorld(px);
    if (onLand(p, r * 0.7) && !poiNear(p, r + 0.6) && !near(p, roadPts, r * 0.8)) hills.push({ x: p[0], z: p[1], r, h, tone: R() });
  }
  const onHill = (p: V2, pad = 0) => hills.some((h) => Math.hypot(h.x - p[0], h.z - p[1]) < h.r + pad);

  // ── 農田 ──
  const fields: Field[] = [];
  const total = FIELD_COLORS.reduce((a, c) => a + c[2], 0);
  const pick = () => { let k = R() * total; for (const c of FIELD_COLORS) { if ((k -= c[2]) < 0) return c; } return FIELD_COLORS[0]; };
  const ANG = -0.72; // 嘉南平原的田區大致順著縱貫線方向
  const ca = Math.cos(ANG), sa = Math.sin(ANG);
  const step = 1.08;
  for (let u = -24; u < 24; u += step) for (let v = -16; v < 16; v += step * 0.86) {
    const x = u * ca - v * sa + (R() - 0.5) * 0.12, z = u * sa + v * ca + (R() - 0.5) * 0.12;
    if (x < BOUNDS.minX || x > BOUNDS.maxX || z < BOUNDS.minZ || z > BOUNDS.maxZ) continue;
    const p: V2 = [x, z];
    if (!onLand(p, 0.55) || inTown(p) || onHill(p, 0.2) || R() > 0.8) continue;
    if (near(p, roadPts, 0.62) || near(p, riverLines, 0.62) || (RAIL.length && distToLine(p, RAIL) < 0.62) || poiNear(p, 1.15)) continue;
    const [color, kind] = pick();
    fields.push({ x, z, w: step * (0.78 + R() * 0.14), d: step * 0.86 * (0.74 + R() * 0.16), r: -ANG + (R() - 0.5) * 0.06, color, kind });
  }
  const inField = (p: V2) => fields.some((f) => {
    const dx = p[0] - f.x, dz = p[1] - f.z, c = Math.cos(f.r), s = Math.sin(f.r);
    return Math.abs(dx * c - dz * s) < f.w / 2 + 0.08 && Math.abs(dx * s + dz * c) < f.d / 2 + 0.08;
  });

  // ── 房子：市區＋各村聚落 ──
  const houses: HouseSpot[] = [];
  const clusters: [V2, number, number, boolean][] = [
    [[378, 285], 62, 78, true], [[300, 378], 34, 26, true], [[220, 240], 20, 9, false], [[160, 330], 20, 9, false],
    [[250, 405], 22, 11, false], [[455, 236], 20, 10, false], [[520, 170], 20, 8, false], [[560, 318], 22, 11, false],
    [[650, 350], 18, 8, false], [[765, 392], 18, 8, false], [[808, 470], 14, 6, false], [[300, 178], 20, 9, false],
    [[425, 128], 15, 6, false], [[205, 160], 15, 6, false], [[580, 250], 14, 5, false],
  ];
  for (const [c, rad, count, isTown] of clusters) {
    let placed = 0;
    for (let tries = 0; tries < count * 14 && placed < count; tries++) {
      const a = R() * Math.PI * 2, d = Math.sqrt(R()) * rad;
      const p = toWorld([c[0] + Math.cos(a) * d, c[1] + Math.sin(a) * d]);
      if (!onLand(p, 0.35) || onHill(p, 0.1) || near(p, roadPts, 0.3) || near(p, riverLines, 0.4)) continue;
      if (RAIL.length && distToLine(p, RAIL) < 0.38) continue;
      if (poiNear(p, 0.75) || inField(p) || houses.some((h) => Math.hypot(h.x - p[0], h.z - p[1]) < 0.44)) continue;
      const tall = isTown && R() < 0.35;
      houses.push({
        x: p[0], z: p[1], w: 0.3 + R() * 0.16, d: 0.28 + R() * 0.12, h: tall ? 0.5 + R() * 0.35 : 0.22 + R() * 0.16,
        r: ANG + Math.PI / 2 + Math.floor(R() * 2) * (Math.PI / 2) + (R() - 0.5) * 0.15,
        roof: Math.floor(R() * 8), wall: Math.floor(R() * 3),
      });
      placed++;
    }
  }

  // ── 樹：沿著主要道路的行道樹＋河岸＋散落各處的樹叢 ──
  const trees: Tree[] = [];
  const freeForTree = (p: V2) => onLand(p, 0.25) && !near(p, roadPts, 0.24) && !near(p, riverLines, 0.3) &&
    !(RAIL.length && distToLine(p, RAIL) < 0.3) && !poiNear(p, 0.7) && !inField(p) &&
    !houses.some((h) => Math.hypot(h.x - p[0], h.z - p[1]) < 0.3) && !trees.some((t) => Math.hypot(t.x - p[0], t.z - p[1]) < 0.28);
  for (const r of roads) {
    if (!r.main) continue;
    const n = Math.floor(r.curve.getLength() / 0.9);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, p = r.curve.getPointAt(t), tan = r.curve.getTangentAt(t);
      const side = i % 2 ? 1 : -1;
      const q: V2 = [p.x - tan.z * 0.4 * side, p.z + tan.x * 0.4 * side];
      if (!inTown(q) && freeForTree(q)) trees.push({ x: q[0], z: q[1], s: 0.75 + R() * 0.25, kind: 0, tone: R() });
    }
  }
  for (const rv of rivers) {
    const n = Math.floor(rv.curve.getLength() / 0.7);
    for (let i = 0; i < n; i++) {
      const t = (i + R()) / n, p = rv.curve.getPointAt(Math.min(t, 1)), tan = rv.curve.getTangentAt(Math.min(t, 1));
      const side = R() < 0.5 ? 1 : -1, off = (rv.main ? 0.55 : 0.4) + R() * 0.25;
      const q: V2 = [p.x - tan.z * off * side, p.z + tan.x * off * side];
      if (R() < 0.7 && freeForTree(q)) trees.push({ x: q[0], z: q[1], s: 0.8 + R() * 0.35, kind: R() < 0.25 ? 1 : 0, tone: R() });
    }
  }
  for (let i = 0; i < 2600 && trees.length < 560; i++) {
    const p: V2 = [BOUNDS.minX + R() * (BOUNDS.maxX - BOUNDS.minX), BOUNDS.minZ + R() * (BOUNDS.maxZ - BOUNDS.minZ)];
    const east = p[0] > 6;
    if (!east && R() < 0.35) continue;
    if (!freeForTree(p)) continue;
    // 檳榔樹是嘉義丘陵的風景
    const kind: Tree['kind'] = onHill(p, 0.1) ? (R() < 0.5 ? 2 : 1) : R() < 0.12 ? 2 : R() < 0.2 ? 1 : 0;
    trees.push({ x: p[0], z: p[1], s: 0.7 + R() * 0.45, kind, tone: R() });
    // 樹叢：旁邊再長幾棵
    for (let k = 0; k < 2; k++) {
      const q: V2 = [p[0] + (R() - 0.5) * 0.8, p[1] + (R() - 0.5) * 0.8];
      if (freeForTree(q)) trees.push({ x: q[0], z: q[1], s: 0.6 + R() * 0.4, kind, tone: R() });
    }
  }

  const groundY = (x: number, z: number) => {
    let y = 0;
    for (const h of hills) {
      const d = Math.hypot(h.x - x, h.z - z) / h.r;
      if (d < 1) y = Math.max(y, h.h * Math.sqrt(1 - d * d) * 0.92);
    }
    return y;
  };
  // 小花叢：散在樹旁、房子邊、河岸，讓草地熱鬧一點
  const flowers: { x: number; z: number; c: number; s: number }[] = [];
  for (let i = 0; i < 3000 && flowers.length < 420; i++) {
    const near0 = R() < 0.6 ? trees[Math.floor(R() * trees.length)] : houses[Math.floor(R() * houses.length)];
    if (!near0) continue;
    const p: V2 = [near0.x + (R() - 0.5) * 1.1, near0.z + (R() - 0.5) * 1.1];
    if (!onLand(p, 0.2) || near(p, roadPts, 0.22) || near(p, riverLines, 0.32) || inField(p) || poiNear(p, 0.6)) continue;
    if (houses.some((h) => Math.hypot(h.x - p[0], h.z - p[1]) < 0.28) || trees.some((t) => Math.hypot(t.x - p[0], t.z - p[1]) < 0.16)) continue;
    flowers.push({ x: p[0], z: p[1], c: Math.floor(R() * 5), s: 0.6 + R() * 0.5 });
  }
  const lamps: { x: number; z: number }[] = [];
  for (const r of roads) {
    if (!r.main) continue;
    const n = Math.floor(r.curve.getLength() / 1.7);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.25) / n, p = r.curve.getPointAt(t), tan = r.curve.getTangentAt(t);
      const side = i % 2 ? 1 : -1;
      const q: V2 = [p.x - tan.z * 0.26 * side, p.z + tan.x * 0.26 * side];
      if (onLand(q, 0.2) && !poiNear(q, 0.7)) lamps.push({ x: q[0], z: q[1] });
    }
  }
  return { roads, rivers, rail, fields, trees, houses, hills, flowers, lamps, groundY };
}

export const landShape = () => {
  const s = new THREE.Shape();
  LAND.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z)));
  s.closePath();
  return s;
};
