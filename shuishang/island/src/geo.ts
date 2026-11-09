// 地理幾何與座標換算。
// geo.json 由 scripts/geo.mjs 從 OpenStreetMap 資料產生，座標是 1000 × 625 的畫框（與 map-data.js 圖釘相同）。
import * as THREE from 'three';
import raw from './geo.json';

export type V2 = [number, number];

interface Geo {
  frame: V2;
  tropicY: number;
  land: V2[];
  rivers: { name: string; main: boolean; pts: V2[] }[];
  rail: V2[][];
}
export const GEO = raw as unknown as Geo;

/** 1 個世界單位 = 畫框 20 px（約 280 公尺）。 */
export const K = 20;
const CX = 500, CY = 312;

/** 畫框座標 → 世界座標 (x, z)。北方朝 -z。 */
export const toWorld = ([x, y]: V2): V2 => [(x - CX) / K, (y - CY) / K];
/** map-data.js 的百分比座標 → 世界座標。 */
export const pctToWorld = (px: number, py: number): V2 => toWorld([(px / 100) * GEO.frame[0], (py / 100) * GEO.frame[1]]);

export const LAND: V2[] = GEO.land.map(toWorld);
export const RIVERS = GEO.rivers.map((r) => ({ ...r, pts: r.pts.map(toWorld) }));
export const RAIL: V2[] = (GEO.rail[0] || []).map(toWorld);
export const TROPIC_Z = toWorld([0, GEO.tropicY])[1];

export const BOUNDS = LAND.reduce(
  (b, [x, z]) => ({ minX: Math.min(b.minX, x), maxX: Math.max(b.maxX, x), minZ: Math.min(b.minZ, z), maxZ: Math.max(b.maxZ, z) }),
  { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity },
);

export function insideLand(p: V2, poly: V2[] = LAND): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/** 點到折線的最短距離。closed = 視為封閉多邊形。 */
export function distToLine(p: V2, pts: V2[], closed = false): number {
  let best = Infinity;
  const n = pts.length;
  for (let i = closed ? 0 : 1; i < n; i++) {
    const a = pts[(i - 1 + n) % n], b = pts[i];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy));
  }
  return best;
}

/** 在島上、且離岸邊至少 margin。 */
export const onLand = (p: V2, margin = 0.3) => insideLand(p) && distToLine(p, LAND, true) >= margin;

/** 水平線 z = const 與鄉界相交、落在島內的區段（北回歸線用）。 */
export function landSpansAtZ(z: number): [number, number][] {
  const xs: number[] = [];
  for (let i = 0, j = LAND.length - 1; i < LAND.length; j = i++) {
    const [x1, z1] = LAND[j], [x2, z2] = LAND[i];
    if (z1 > z !== z2 > z) xs.push(x1 + ((z - z1) / (z2 - z1)) * (x2 - x1));
  }
  xs.sort((a, b) => a - b);
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < xs.length; i += 2) out.push([xs[i], xs[i + 1]]);
  return out;
}

/** 固定種子的亂數，每次載入島嶼長得都一樣。 */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 折線 → 平滑曲線（y 固定）。 */
export function curveOf(pts: V2[], y = 0, closed = false, tension = 0.5) {
  return new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, y, z)), closed, 'catmullrom', tension);
}

/**
 * 沿曲線產生平貼地面的帶狀網格（道路、河流、鐵道）。
 * uv.x 是沿線距離（世界單位），讓河流貼圖可以沿著流動方向捲動。
 */
export function ribbon(curve: THREE.Curve<THREE.Vector3>, width: number, y: number, step = 0.25) {
  const len = curve.getLength();
  const n = Math.max(2, Math.ceil(len / step));
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const up = new THREE.Vector3(0, 1, 0), side = new THREE.Vector3();
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    side.crossVectors(up, tan).normalize().multiplyScalar(width / 2);
    pos.push(p.x + side.x, y, p.z + side.z, p.x - side.x, y, p.z - side.z);
    uv.push(t * len, 0, t * len, 1);
    if (i < n) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
