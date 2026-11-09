// 低多邊形積木：共用的幾何、材質與基本形狀。
// 所有模型都用這幾種形狀拼出來，材質依顏色快取共用，draw call 和記憶體都省。
import * as THREE from 'three';
import type { ReactNode } from 'react';

export type Vec3 = [number, number, number];

// ── 調色盤：柔和、明亮、低飽和 ──
export const C = {
  grass: '#A8CC86', grassSide: '#8DB86E', soil: '#E2C394', soilDark: '#C9A06F', base: '#B58A5C',
  water: '#7CC3D6', bank: '#BCDCA2', road: '#F1E8D4', curb: '#D8CBAF', rail: '#8E8F96', gravel: '#CDBA9C',
  wall: '#FFF8EC', wall2: '#F6E9D3', wall3: '#EFE0CC', wood: '#B98B5E', woodDark: '#8C6644', stone: '#D6D0C4',
  coral: '#E8826A', apricot: '#F2B880', sage: '#86B89C', sky: '#79A9CF', butter: '#F3D67A', mauve: '#C597BE',
  brick: '#C9745A', red: '#D6574B', gold: '#F2B544', white: '#FFFFFF', dark: '#4A4F5C', glass: '#A9D6E5',
  leaf: '#7DB36A', leaf2: '#93C37A', leaf3: '#6FA463', pine: '#5E9A6A', trunk: '#9C7452',
};
export const ROOFS = [C.coral, C.apricot, C.sage, C.sky, C.butter, C.mauve, '#E39B7B', '#8FB7C9'];

const cache = new Map<string, THREE.Material>();
/** 依顏色快取的 Lambert 平面著色材質（低多邊形的硬邊感）。 */
export function mat(color: string, opts: { emissive?: string; transparent?: boolean; opacity?: number; side?: THREE.Side } = {}) {
  const key = color + JSON.stringify(opts);
  let m = cache.get(key);
  if (!m) {
    const m2 = new THREE.MeshLambertMaterial({ color, flatShading: true, side: opts.side ?? THREE.FrontSide });
    if (opts.emissive) m2.emissive.set(opts.emissive);
    if (opts.transparent) { m2.transparent = true; m2.opacity = opts.opacity ?? 1; m2.depthWrite = false; }
    m = m2;
    cache.set(key, m);
  }
  return m;
}

// ── 微風：讓樹冠、作物在頂點著色器裡搖擺（不耗 CPU） ──
export const WIND = { value: 0 };
export function windMat(color: string, amp = 0.06, speed = 1.4) {
  const key = 'wind' + color + amp + speed;
  let m = cache.get(key) as THREE.MeshLambertMaterial | undefined;
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color, flatShading: true });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = WIND;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        vec2 wp = vec2(0.0);
        #ifdef USE_INSTANCING
          wp = instanceMatrix[3].xz;
        #endif
        float hh = clamp(position.y + 0.5, 0.0, 1.5);
        float ph = uTime * ${speed.toFixed(2)} + wp.x * 0.37 + wp.y * 0.29;
        transformed.x += sin(ph) * ${amp.toFixed(3)} * hh;
        transformed.z += cos(ph * 0.83) * ${(amp * 0.6).toFixed(3)} * hh;
      `);
    };
    m.customProgramCacheKey = () => key;
    cache.set(key, m);
  }
  return m;
}

// ── 共用幾何（底部對齊 y=0，方便堆疊） ──
const up = (g: THREE.BufferGeometry) => { g.translate(0, 0.5, 0); return g; };
export const G = {
  box: up(new THREE.BoxGeometry(1, 1, 1)),
  cyl: up(new THREE.CylinderGeometry(0.5, 0.5, 1, 8)),
  cyl6: up(new THREE.CylinderGeometry(0.5, 0.5, 1, 6)),
  cone: up(new THREE.ConeGeometry(0.5, 1, 6)),
  cone4: up(new THREE.ConeGeometry(0.5, 1, 4)),
  ico: new THREE.IcosahedronGeometry(0.5, 0),
  sph: new THREE.IcosahedronGeometry(0.5, 1),
  dome: new THREE.SphereGeometry(0.5, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
  prism: (() => {
    // 人字形屋頂：寬 1、深 1、高 1，底部在 y=0
    const s = new THREE.Shape();
    s.moveTo(-0.5, 0); s.lineTo(0.5, 0); s.lineTo(0, 1); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false });
    g.translate(0, 0, -0.5);
    return g;
  })(),
  torus: new THREE.TorusGeometry(0.5, 0.12, 6, 14),
  ring: new THREE.RingGeometry(0.42, 0.5, 32),
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
