// 在地連結：景點之間的弧線（連結線），以及在兩地之間來回搬東西的小人（搬運）。
// 點小人可以看到他正在把什麼，從哪裡搬到哪裡。
import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { CAT, LINKS, type Link, type Poi } from '../data';
import { useStore, frozen } from '../store';
import { Box, C, Sph } from './kit';

interface Resolved { link: Link; a: Poi; b: Poi; i: number; color: string; ground: THREE.QuadraticBezierCurve3; arc: THREE.Vector3[] }

export function useLinks(): Resolved[] {
  const pois = useStore((s) => s.pois);
  return useMemo(() => LINKS.map((link, i) => {
    const a = pois.find((p) => p.id === link.from), b = pois.find((p) => p.id === link.to);
    if (!a || !b) return null;
    const A = new THREE.Vector3(a.pos[0], 0, a.pos[1]), B = new THREE.Vector3(b.pos[0], 0, b.pos[1]);
    const d = A.distanceTo(B);
    const mid = A.clone().lerp(B, 0.5);
    // 地面路徑稍微彎一點，小人不會全部走直線
    const side = new THREE.Vector3(-(B.z - A.z), 0, B.x - A.x).normalize().multiplyScalar(d * 0.18 * (i % 2 ? 1 : -1));
    const ground = new THREE.QuadraticBezierCurve3(A.clone().setY(0.03), mid.clone().add(side).setY(0.03), B.clone().setY(0.03));
    const top = mid.clone().setY(0.9 + d * 0.22);
    const arc = new THREE.QuadraticBezierCurve3(A.clone().setY(0.45), top, B.clone().setY(0.45)).getPoints(40);
    return { link, a, b, i, color: CAT[a.cat].color, ground, arc };
  }).filter(Boolean) as Resolved[], [pois]);
}

/** 協作線：選了景點就亮出它的連結；「連結線」打開時全部顯示。 */
export function LinkLines() {
  const links = useLinks();
  const show = useStore((s) => s.showLinks);
  const sel = useStore((s) => s.selected);
  const refs = useRef<any[]>([]); // eslint-disable-line @typescript-eslint/no-explicit-any
  useFrame((_, dt) => {
    if (frozen()) return;
    refs.current.forEach((l) => { if (l?.material) l.material.dashOffset -= dt * 0.6; });
  });
  return (
    <>
      {links.map((r, k) => {
        const mine = !!sel && (r.link.from === sel || r.link.to === sel);
        if (!show && !mine) return null;
        const dim = !!sel && !mine;
        return (
          <Line key={r.i} ref={(l) => { refs.current[k] = l; }} points={r.arc} color={r.color} lineWidth={mine ? 3.5 : 2.2}
            dashed dashSize={0.25} gapSize={0.16} transparent opacity={dim ? 0.18 : 0.9} />
        );
      })}
    </>
  );
}

const SHIRTS = [C.coral, C.sky, C.sage, C.butter, C.mauve, C.apricot];

function Carrier({ r }: { r: Resolved }) {
  const g = useRef<THREE.Group>(null!);
  const legs = useRef<THREE.Group>(null!);
  const len = useMemo(() => r.ground.getLength(), [r]);
  const s = useRef(((r.i * 0.37) % 1) * len * 2);
  const tmp = useMemo(() => new THREE.Vector3(), []), tan = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    const st = useStore.getState();
    const sel = st.selected;
    const focus = !sel || r.link.from === sel || r.link.to === sel;
    g.current.scale.setScalar(THREE.MathUtils.damp(g.current.scale.x, focus ? 1 : 0.7, 6, dt));
    if (frozen()) return;
    // 每段路走到盡頭停一下（卸貨），再往回走
    const speed = 0.38;
    s.current = (s.current + Math.min(dt, 0.1) * speed) % (len * 2 + 1.6);
    const x = s.current;
    let u: number, back = false;
    if (x < len) u = x / len;
    else if (x < len + 0.8) u = 1;
    else if (x < len * 2 + 0.8) { u = 1 - (x - len - 0.8) / len; back = true; }
    else { u = 0; back = true; }
    r.ground.getPointAt(Math.min(1, Math.max(0, u)), tmp);
    r.ground.getTangentAt(Math.min(1, Math.max(0, u)), tan);
    if (back) tan.negate();
    g.current.position.set(tmp.x, 0.03, tmp.z);
    g.current.rotation.y = Math.atan2(-tan.z, tan.x);
    const walking = (x < len) || (x > len + 0.8 && x < len * 2 + 0.8);
    legs.current.position.y = walking ? Math.abs(Math.sin(x * 14)) * 0.025 : 0;
  });
  const click = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return;
    e.stopPropagation();
    useStore.getState().say(`小人正把「${r.link.what}」從 ${r.a.name} 搬到 ${r.b.name}。${r.link.story}`);
  };
  const shirt = SHIRTS[r.i % SHIRTS.length];
  return (
    <group ref={g} onClick={click}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = ''; }}>
      <group ref={legs}>
        <Box p={[0, 0, 0]} s={[0.07, 0.07, 0.07]} c={C.dark} shadow={false} />
        <Box p={[0, 0.07, 0]} s={[0.09, 0.11, 0.08]} c={shirt} />
        <Sph p={[0, 0.22, 0]} s={0.08} c="#F2D3B6" />
        {/* 頭上扛著的貨物，顏色跟出發地的分類一樣 */}
        <Box p={[0, 0.27, 0]} s={[0.13, 0.08, 0.11]} c={r.color} />
      </group>
      <mesh visible={false} position={[0, 0.18, 0]} scale={[0.35, 0.4, 0.35]}>
        <boxGeometry />
      </mesh>
    </group>
  );
}

export function Carriers() {
  const links = useLinks();
  const show = useStore((s) => s.showCarriers);
  if (!show) return null;
  return <>{links.map((r) => <Carrier key={r.i} r={r} />)}</>;
}
