// 療癒系積木：共用的幾何、材質與基本形狀。
// 圓潤的形狀＋卡通分階光影（toon shading），像一座可愛的模型小鎮。
// 材質依顏色快取共用，draw call 和記憶體都省。
import * as THREE from 'three';
import type { ReactNode } from 'react';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export type Vec3 = [number, number, number];

// ── 調色盤：飽滿、溫暖、像糖果一樣的顏色 ──
export const C = {
  grass: '#8FCF6E', grassSide: '#79BC5B', soil: '#EBCB9B', soilDark: '#D6AB78', base: '#B98B5B',
  water: '#5DC7D8', bank: '#DDF1D3', road: '#F6EBD3', curb: '#E3D2AE', rail: '#8E8F96', gravel: '#D8C3A0',
  wall: '#FFF8EC', wall2: '#FBEBD3', wall3: '#F4E2CB', wood: '#C08E5D', woodDark: '#8F6642', stone: '#DDD6C8',
  coral: '#F07E6E', apricot: '#F5A65B', sage: '#6FBF8E', sky: '#6AA8E0', butter: '#F6CF57', mauve: '#C48BD6',
  brick: '#D9775C', red: '#E5574A', gold: '#F5B83C', white: '#FFFFFF', dark: '#4A4F5C', glass: '#A6DCEB',
  leaf: '#6FC05A', leaf2: '#86CC62', leaf3: '#5FB052', pine: '#4FA163', trunk: '#A87A50',
};
export const ROOFS = [C.coral, C.apricot, C.sage, C.sky, C.butter, C.mauve, '#EE8FA8', '#5FC2C2'];

// 卡通分階光影：亮面、半亮、陰影三四階，邊界清楚但柔和
const TOON = (() => {
  const d = new Uint8Array([150, 205, 240, 255]);
  const t = new THREE.DataTexture(d, d.length, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();

// ── 全域動畫數值 ──
export const WIND = { value: 0 };
/** 動畫時鐘：暫停時停住，所有待機動畫都看它（和微風共用同一個值） */
export const ANIM = WIND;
/** 夜晚程度 0（白天）→ 1（深夜），由時間光線控制 */
export const NIGHT = { value: 0 };
/** 開場「長出來」的時間（秒）：樹、房子、花、田從島中心往外一個個冒出來 */
export const GROW = { value: 0 };

/**
 * 在頂點著色器裡加上：
 * - 開場長出來（只對 InstancedMesh：每個實例依離中心的距離延遲，帶一點回彈）
 * - 微風搖擺（amp > 0 時）
 */
function cozyShader(m: THREE.Material, key: string, amp = 0, speed = 1.4) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = WIND;
    sh.uniforms.uGrow = GROW;
    sh.vertexShader = 'uniform float uTime;\nuniform float uGrow;\n' + sh.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      vec2 wp = vec2(0.0);
      #ifdef USE_INSTANCING
        wp = instanceMatrix[3].xz;
        float gt = clamp((uGrow - 0.35 - length(wp) * 0.055) / 0.55, 0.0, 1.0);
        // back-out 回彈曲線（不用 pow：負數的 pow 在 GPU 上沒有定義）
        float gu = 1.0 - gt;
        float gb = 1.0 - 2.70158 * gu * gu * gu + 1.70158 * gu * gu;
        transformed *= gb;
      #endif
      ${amp > 0 ? `
      float hh = clamp(position.y + 0.5, 0.0, 1.5);
      float ph = uTime * ${speed.toFixed(2)} + wp.x * 0.37 + wp.y * 0.29;
      transformed.x += sin(ph) * ${amp.toFixed(3)} * hh;
      transformed.z += cos(ph * 0.83) * ${(amp * 0.6).toFixed(3)} * hh;` : ''}
    `);
  };
  m.customProgramCacheKey = () => key;
}

/** 讓自訂材質（例如窗戶、路燈）也跟著開場一起長出來。 */
export const addGrow = (m: THREE.Material, key: string) => cozyShader(m, 'grow' + key);

const cache = new Map<string, THREE.Material>();
/** 依顏色快取的卡通材質。 */
export function mat(color: string, opts: { emissive?: string; transparent?: boolean; opacity?: number; side?: THREE.Side } = {}) {
  const key = color + JSON.stringify(opts);
  let m = cache.get(key);
  if (!m) {
    const m2 = new THREE.MeshToonMaterial({ color, gradientMap: TOON, side: opts.side ?? THREE.FrontSide });
    if (opts.emissive) m2.emissive.set(opts.emissive);
    if (opts.transparent) { m2.transparent = true; m2.opacity = opts.opacity ?? 1; m2.depthWrite = false; }
    cozyShader(m2, 'toon' + key);
    m = m2;
    cache.set(key, m);
  }
  return m;
}

/** 會隨風搖擺的卡通材質（樹冠、作物、花）。 */
export function windMat(color: string, amp = 0.06, speed = 1.4) {
  const key = 'wind' + color + amp + speed;
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color, gradientMap: TOON });
    cozyShader(m, key, amp, speed);
    cache.set(key, m);
  }
  return m;
}

/** 有貼圖的卡通材質（草地、土層）。 */
export function texMat(map: THREE.Texture) {
  return new THREE.MeshToonMaterial({ map, gradientMap: TOON });
}

// ── 共用幾何（底部對齊 y=0，方便堆疊）：全部圓潤平滑 ──
const up = (g: THREE.BufferGeometry) => { g.translate(0, 0.5, 0); return g; };
export const G = {
  box: up(new RoundedBoxGeometry(1, 1, 1, 2, 0.09)),
  cyl: up(new THREE.CylinderGeometry(0.5, 0.5, 1, 20)),
  cyl6: up(new THREE.CylinderGeometry(0.5, 0.5, 1, 14)),
  cone: up(new THREE.ConeGeometry(0.5, 1, 16)),
  cone4: up(new THREE.ConeGeometry(0.5, 1, 4)),
  ico: new THREE.SphereGeometry(0.5, 16, 12),
  sph: new THREE.SphereGeometry(0.5, 20, 14),
  dome: new THREE.SphereGeometry(0.5, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
  prism: (() => {
    // 人字形屋頂：寬 1、深 1、高 1，底部在 y=0；邊緣做一點圓角
    const s = new THREE.Shape();
    s.moveTo(-0.5, 0); s.lineTo(0.5, 0); s.lineTo(0, 1); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.9, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 2 });
    g.translate(0, 0, -0.45);
    return g;
  })(),
  torus: new THREE.TorusGeometry(0.5, 0.14, 10, 24),
  ring: new THREE.RingGeometry(0.42, 0.5, 40),
};

interface P { p?: Vec3; s?: Vec3 | number; r?: Vec3; c: string; shadow?: boolean; m?: THREE.Material }
const sc = (s?: Vec3 | number): Vec3 => (s === undefined ? [1, 1, 1] : typeof s === 'number' ? [s, s, s] : s);
function Prim({ g, p, s, r, c, shadow = true, m }: P & { g: THREE.BufferGeometry }) {
  return <mesh geometry={g} material={m || mat(c)} position={p} scale={sc(s)} rotation={r} castShadow={shadow} receiveShadow />;
}
export const Box = (q: P) => <Prim g={G.box} {...q} />;
export const Cyl = (q: P) => <Prim g={G.cyl} {...q} />;
export const Cyl6 = (q: P) => <Prim g={G.cyl6} {...q} />;
export const Cone = (q: P) => <Prim g={G.cone} {...q} />;
export const Pyr = (q: P) => <Prim g={G.cone4} {...q} />;
export const Ico = (q: P) => <Prim g={G.ico} {...q} />;
export const Sph = (q: P) => <Prim g={G.sph} {...q} />;
export const Dome = (q: P) => <Prim g={G.dome} {...q} />;
export const Roof = (q: P) => <Prim g={G.prism} {...q} />;

/** 一棟有人字屋頂的小房子。 */
export function House({ p = [0, 0, 0], w = 0.6, d = 0.5, h = 0.4, roof = C.coral, wall = C.wall, rh = 0.28, r = 0 }:
  { p?: Vec3; w?: number; d?: number; h?: number; roof?: string; wall?: string; rh?: number; r?: number }) {
  return (
    <group position={p} rotation={[0, r, 0]}>
      <Box s={[w, h, d]} c={wall} />
      <Roof p={[0, h, 0]} s={[w + 0.08, rh, d + 0.08]} c={roof} />
      <Box p={[0, 0, d / 2 + 0.005]} s={[0.12, 0.2, 0.02]} c={C.woodDark} shadow={false} />
    </group>
  );
}

/** 窗戶：一排小方塊貼在牆面上。 */
export function Windows({ y, z, xs, c = C.glass, size = 0.09 }: { y: number; z: number; xs: number[]; c?: string; size?: number }) {
  return <>{xs.map((x, i) => <Box key={i} p={[x, y, z]} s={[size, size, 0.02]} c={c} shadow={false} />)}</>;
}

export function Group({ children, p, r }: { children: ReactNode; p?: Vec3; r?: number }) {
  return <group position={p} rotation={[0, r || 0, 0]}>{children}</group>;
}
