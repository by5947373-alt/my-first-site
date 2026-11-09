// 各景點的低多邊形模型與專屬動畫。
// 每個模型拿到 active（被選中）和 pulse（被點擊的次數）——點擊時觸發專屬效果。
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import gsap from 'gsap';
import { Box, C, Cone, Cyl, Cyl6, Dome, G, House, Ico, Pyr, Roof, Sph, Windows, mat, windMat, type Vec3 } from './kit';
import type { Model } from '../data';
import { useStore } from '../store';

export interface ModelProps { active: boolean; pulse: number }
const still = () => useStore.getState().reduced;

/** 煙／蒸氣：幾顆半透明的低多邊形球，上升、變大、淡出，循環不停。 */
function Puffs({ p, count = 5, size = 0.18, rise = 1.4, speed = 0.35, c = '#FFFFFF', boost }:
  { p: Vec3; count?: number; size?: number; rise?: number; speed?: number; c?: string; boost?: boolean }) {
  const items = useMemo(() => Array.from({ length: count }, (_, i) => ({
    m: new THREE.MeshLambertMaterial({ color: c, flatShading: true, transparent: true, depthWrite: false }),
    o: i / count, drift: (i % 2 ? 1 : -1) * 0.12,
  })), [count, c]);
  const refs = useRef<THREE.Mesh[]>([]);
  const k = useRef(0);
  useFrame((_, dt) => {
    if (!still()) k.current += Math.min(dt, 0.1) * speed * (boost ? 2.2 : 1);
    items.forEach((it, i) => {
      const m = refs.current[i];
      if (!m) return;
      const t = (k.current + it.o) % 1;
      m.position.set(p[0] + it.drift * t + t * 0.2, p[1] + t * rise, p[2] + it.drift * 0.5 * t);
      m.scale.setScalar(size * (0.5 + t * (boost ? 1.8 : 1.3)));
      it.m.opacity = Math.sin(t * Math.PI) * (boost ? 0.95 : 0.75);
    });
  });
  return <>{items.map((it, i) => <mesh key={i} ref={(m) => { if (m) refs.current[i] = m; }} geometry={G.ico} material={it.m} />)}</>;
}

/** 擺動（燈籠、招牌）。 */
function Swing({ children, p, amp = 0.25, speed = 2, phase = 0 }: { children: React.ReactNode; p: Vec3; amp?: number; speed?: number; phase?: number }) {
  const ref = useRef<THREE.Group>(null!);
  useFrame(({ clock }) => { if (!still()) ref.current.rotation.z = Math.sin(clock.elapsedTime * speed + phase) * amp; });
  return <group ref={ref} position={p}>{children}</group>;
}

/** 自轉。 */
function Spin({ children, p, speed = 0.6, axis = 'y', fast }: { children: React.ReactNode; p?: Vec3; speed?: number; axis?: 'x' | 'y' | 'z'; fast?: boolean }) {
  const ref = useRef<THREE.Group>(null!);
  useFrame((_, dt) => { if (!still()) ref.current.rotation[axis] += dt * speed * (fast ? 4 : 1); });
  return <group ref={ref} position={p}>{children}</group>;
}

/** 上下輕飄。 */
function Bob({ children, p, amp = 0.05, speed = 1.6, phase = 0 }: { children: React.ReactNode; p?: Vec3; amp?: number; speed?: number; phase?: number }) {
  const ref = useRef<THREE.Group>(null!);
  const y0 = p?.[1] ?? 0;
  useFrame(({ clock }) => { if (!still()) ref.current.position.y = y0 + Math.sin(clock.elapsedTime * speed + phase) * amp; });
  return <group ref={ref} position={p}>{children}</group>;
}

// ─────────────────────────── 北回歸線標誌 ───────────────────────────
function Tropic({ active, pulse }: ModelProps) {
  const beam = useRef<THREE.Mesh>(null!);
  const ring = useRef<THREE.Mesh>(null!);
  const sun = useRef<THREE.Mesh>(null!);
  const beamMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#FFE08A', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }), []);
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#F6C453', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }), []);
  const sunMat = useMemo(() => new THREE.MeshLambertMaterial({ color: C.gold, emissive: new THREE.Color('#F2B544'), emissiveIntensity: 0.2, flatShading: true }), []);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  useEffect(() => {
    if (!pulse) return;
    // 點擊：陽光從天而降，地面擴散一圈光環
    const tl = gsap.timeline();
    tlRef.current = tl;
    tl.fromTo(beam.current.scale, { y: 0.01 }, { y: 1, duration: 0.6, ease: 'power3.out' }, 0)
      .fromTo(beamMat, { opacity: 0 }, { opacity: 0.55, duration: 0.3 }, 0)
      .to(beamMat, { opacity: 0.22, duration: 1.6, ease: 'sine.inOut' }, 0.9)
      .fromTo(ring.current.scale, { x: 0.2, y: 0.2, z: 0.2 }, { x: 3.2, y: 3.2, z: 3.2, duration: 1.4, ease: 'power2.out' }, 0.1)
      .fromTo(ringMat, { opacity: 0.9 }, { opacity: 0, duration: 1.4, ease: 'power2.out' }, 0.1)
      .fromTo(sunMat, { emissiveIntensity: 1.2 }, { emissiveIntensity: 0.2, duration: 1.8 }, 0);
    return () => { tl.kill(); };
  }, [pulse]); // eslint-disable-line react-hooks/exhaustive-deps
  // 取消選取：光束收起來（先停掉還在播的點擊動畫，免得它又把光打開）
  useEffect(() => {
    if (active) return;
    tlRef.current?.kill();
    gsap.to(beamMat, { opacity: 0, duration: 0.6 });
    gsap.to(ringMat, { opacity: 0, duration: 0.3 });
  }, [active, beamMat, ringMat]);
  useFrame(({ clock }) => {
    if (!still()) sun.current.rotation.y = clock.elapsedTime * 0.8;
  });
  return (
    <group>
      <Cyl6 s={[1.1, 0.12, 1.1]} c={C.stone} />
      <Cyl6 p={[0, 0.12, 0]} s={[0.8, 0.1, 0.8]} c={C.wall2} />
      <Pyr p={[0, 0.22, 0]} s={[0.34, 1.7, 0.34]} c={C.white} />
      <group position={[0, 1.95, 0]}>
        <mesh ref={sun} geometry={G.torus} material={sunMat} scale={[0.55, 0.55, 0.7]} castShadow />
        <Sph s={0.24} c={C.gold} />
      </group>
      <mesh ref={beam} position={[0, 0, 0]} material={beamMat} scale={[1, 0.01, 1]}>
        <cylinderGeometry args={[0.35, 0.7, 7, 12, 1, true]} />
      </mesh>
      <mesh ref={ring} geometry={G.ring} material={ringMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} />
    </group>
  );
}

// ─────────────────────────── 太空教育館 ───────────────────────────
function Space({ active, pulse }: ModelProps) {
  const stars = useRef<THREE.Group>(null!);
  useEffect(() => {
    if (!pulse) return;
    gsap.fromTo(stars.current.scale, { x: 0.3, y: 0.3, z: 0.3 }, { x: 1, y: 1, z: 1, duration: 0.9, ease: 'back.out(2)' });
  }, [pulse]);
  useFrame(({ clock }) => {
    if (still()) return;
    stars.current.children.forEach((s, i) => s.scale.setScalar(0.06 + 0.03 * Math.sin(clock.elapsedTime * 3 + i * 1.3)));
  });
  return (
    <group>
      <Box s={[1.5, 0.4, 0.9]} c={C.wall} />
      <Windows y={0.18} z={0.455} xs={[-0.5, -0.25, 0.25, 0.5]} />
      <Box p={[0, 0, 0.46]} s={[0.25, 0.3, 0.04]} c={C.sky} shadow={false} />
      <Cyl p={[0, 0.4, 0]} s={[0.8, 0.08, 0.8]} c={C.stone} />
      <Dome p={[0, 0.48, 0]} s={[0.78, 0.7, 0.78]} c="#DCE6F2" />
      <Box p={[0.12, 0.62, 0.18]} s={[0.06, 0.14, 0.32]} c={C.dark} r={[0.5, 0, 0]} />
      {/* 漂浮的行星、光環與衛星 */}
      <Bob p={[0, 1.55, 0]} amp={0.08} speed={1.2}>
        <Spin speed={0.5} fast={active}>
          <Sph s={0.46} c="#E8A87C" />
          <mesh geometry={G.torus} material={mat(C.butter)} rotation={[Math.PI / 2.4, 0, 0]} scale={[0.72, 0.72, 0.25]} castShadow />
          <Spin speed={1.6} fast={active}><Sph p={[0.62, 0.1, 0]} s={0.12} c={C.sky} /></Spin>
        </Spin>
      </Bob>
      <group ref={stars} position={[0, 1.55, 0]}>
        {[[0.8, 0.5, 0.2], [-0.7, 0.35, -0.3], [0.3, 0.8, -0.5], [-0.5, -0.3, 0.5], [0.6, -0.2, -0.6], [-0.2, 0.6, 0.7]].map((p, i) => (
          <mesh key={i} geometry={G.ico} material={mat('#FFE9A8', { emissive: '#F6C453' })} position={p as Vec3} scale={0.07} />
        ))}
      </group>
    </group>
  );
}

// ─────────────────────────── 南靖糖廠 ───────────────────────────
function Sugar({ active }: ModelProps) {
  return (
    <group>
      <Box s={[1.7, 0.5, 0.8]} c="#E7A58C" />
      <Roof p={[0, 0.5, 0]} s={[0.88, 0.3, 1.78]} c={C.brick} r={[0, Math.PI / 2, 0]} />
      <Box p={[0.15, 0.5, 0]} s={[0.06, 0.32, 0.9]} c={C.brick} />
      <Windows y={0.25} z={0.405} xs={[-0.6, -0.3, 0, 0.3, 0.6]} c={C.wall} size={0.12} />
      <Box p={[-0.55, 0, 0.6]} s={[0.55, 0.32, 0.4]} c={C.wall2} />
      <Roof p={[-0.55, 0.32, 0.6]} s={[0.6, 0.18, 0.45]} c={C.coral} />
      {/* 煙囪與白煙 */}
      <Cyl p={[0.62, 0, -0.25]} s={[0.22, 1.9, 0.22]} c={C.brick} />
      <Cyl p={[0.62, 1.55, -0.25]} s={[0.25, 0.1, 0.25]} c={C.wall} />
      <Cyl p={[0.62, 1.9, -0.25]} s={[0.27, 0.06, 0.27]} c={C.woodDark} />
      <Puffs p={[0.62, 2.05, -0.25]} count={6} size={0.32} rise={1.8} speed={0.18} c="#F7F3EE" boost={active} />
      {/* 糖袋與五分車 */}
      <Box p={[-0.2, 0, 0.62]} s={[0.18, 0.12, 0.14]} c={C.wall} />
      <Box p={[-0.02, 0, 0.62]} s={[0.18, 0.12, 0.14]} c={C.wall2} />
    </group>
  );
}

// ─────────────────────────── 品皇咖啡 ───────────────────────────
function Coffee({ active }: ModelProps) {
  return (
    <group>
      <Box s={[1.2, 0.55, 0.85]} c={C.wall2} />
      <Box p={[0, 0.55, 0]} s={[1.26, 0.06, 0.9]} c={C.woodDark} />
      <Windows y={0.25} z={0.43} xs={[-0.4, -0.15, 0.15, 0.4]} c={C.butter} size={0.13} />
      <Box p={[0, 0.02, 0.5]} s={[1.2, 0.04, 0.14]} c="#B5835A" shadow={false} />
      {/* 屋頂上的大咖啡杯 */}
      <group position={[0, 0.6, 0]}>
        <Cyl s={[0.55, 0.45, 0.55]} c={C.white} />
        <Cyl p={[0, 0.42, 0]} s={[0.47, 0.04, 0.47]} c="#7A4E33" shadow={false} />
        <mesh geometry={G.torus} material={mat(C.white)} position={[0.32, 0.22, 0]} scale={[0.22, 0.22, 0.4]} castShadow />
        <Cyl p={[0, -0.02, 0]} s={[0.75, 0.04, 0.75]} c={C.white} />
      </group>
      <Puffs p={[0, 1.1, 0]} count={4} size={0.14} rise={0.8} speed={0.45} c="#FFFFFF" boost={active} />
      {/* 旋轉的咖啡豆招牌 */}
      <group position={[-0.7, 0, 0.35]}>
        <Cyl s={[0.04, 0.7, 0.04]} c={C.woodDark} />
        <Spin p={[0, 0.82, 0]} speed={1.2} fast={active}>
          <Sph s={[0.26, 0.17, 0.2]} c="#7A4E33" />
        </Spin>
      </group>
    </group>
  );
}

// ─────────────────────────── 白人牙膏・將軍府 ───────────────────────────
function Mansion({ active }: ModelProps) {
  const roof = '#D9694F';
  return (
    <group>
      {/* 三合院：正身＋兩側護龍 */}
      <Box p={[0, 0, -0.3]} s={[1.3, 0.38, 0.4]} c="#E9B8A0" />
      <Roof p={[0, 0.38, -0.3]} s={[0.5, 0.26, 1.4]} c={roof} r={[0, Math.PI / 2, 0]} />
      <Box p={[-0.55, 0, 0.18]} s={[0.32, 0.3, 0.6]} c="#E9B8A0" />
      <Roof p={[-0.55, 0.3, 0.18]} s={[0.4, 0.2, 0.66]} c={roof} />
      <Box p={[0.55, 0, 0.18]} s={[0.32, 0.3, 0.6]} c="#E9B8A0" />
      <Roof p={[0.55, 0.3, 0.18]} s={[0.4, 0.2, 0.66]} c={roof} />
      <Box p={[0, 0, -0.095]} s={[0.22, 0.3, 0.02]} c={C.red} shadow={false} />
      <Box p={[0, 0.005, 0.2]} s={[0.75, 0.01, 0.55]} c={C.stone} shadow={false} />
      {/* 立在廣場上的大牙膏 */}
      <Bob p={[0.05, 0.25, 0.3]} amp={0.06} speed={active ? 4 : 1.4}>
        <group rotation={[0, 0, 0.35]}>
          <Box s={[0.42, 0.14, 0.22]} c={C.white} />
          <Box p={[-0.03, 0.005, 0]} s={[0.25, 0.145, 0.225]} c={C.sky} shadow={false} />
          <Cyl p={[0.24, 0.03, 0]} r={[0, 0, -Math.PI / 2]} s={[0.1, 0.06, 0.1]} c={C.red} />
        </group>
      </Bob>
    </group>
  );
}

// ─────────────────────────── 廟宇 ───────────────────────────
function Temple({ active }: ModelProps) {
  const roofC = '#E2A04A';
  return (
    <group>
      <Box s={[1.3, 0.12, 1.0]} c={C.stone} />
      <Box p={[0, 0.12, -0.05]} s={[1.0, 0.42, 0.65]} c={C.red} />
      {/* 雙層燕尾屋頂（兩端起翹） */}
      <Roof p={[0, 0.54, -0.05]} s={[0.85, 0.24, 1.25]} c={roofC} r={[0, Math.PI / 2, 0]} />
      <Roof p={[0, 0.76, -0.05]} s={[0.6, 0.22, 0.85]} c={roofC} r={[0, Math.PI / 2, 0]} />
      {[-1, 1].map((sd) => (
        <group key={sd}>
          <Cone p={[sd * 0.64, 0.6, -0.05]} r={[0, 0, sd * -0.9]} s={[0.1, 0.26, 0.1]} c={roofC} />
          <Cone p={[sd * 0.44, 0.82, -0.05]} r={[0, 0, sd * -0.9]} s={[0.08, 0.22, 0.08]} c={roofC} />
        </group>
      ))}
      <Sph p={[0, 1.0, -0.05]} s={0.12} c={C.gold} />
      {[-0.35, 0.35].map((x) => <Cyl key={x} p={[x, 0.12, 0.3]} s={[0.07, 0.42, 0.07]} c="#B83A32" />)}
      <Box p={[0, 0.12, 0.275]} s={[0.3, 0.3, 0.02]} c="#7A2E28" shadow={false} />
      {/* 燈籠 */}
      {[-0.22, 0.22].map((x, i) => (
        <Swing key={x} p={[x, 0.53, 0.33]} amp={active ? 0.45 : 0.18} speed={active ? 4 : 1.8} phase={i}>
          <Box p={[0, -0.05, 0]} s={[0.01, 0.05, 0.01]} c={C.dark} shadow={false} />
          <Sph p={[0, -0.12, 0]} s={[0.11, 0.14, 0.11]} c="#E8483B" />
        </Swing>
      ))}
      {/* 香爐與香煙 */}
      <Cyl p={[0, 0.12, 0.42]} s={[0.18, 0.12, 0.18]} c={C.gold} />
      <Puffs p={[0, 0.3, 0.42]} count={4} size={0.08} rise={0.7} speed={0.3} c="#EDE7DD" boost={active} />
    </group>
  );
}

// ─────────────────────────── 夜市 ───────────────────────────
function Market({ active }: ModelProps) {
  const bulbs = useRef<THREE.MeshBasicMaterial[]>([]);
  const people = useRef<THREE.Group[]>([]);
  const awn = [C.coral, C.sky, C.butter, C.sage, C.mauve];
  const bulbList = useMemo(() => Array.from({ length: 14 }, (_, i) => i), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    bulbs.current.forEach((m, i) => {
      if (!m) return;
      const on = still() ? 1 : 0.55 + 0.45 * Math.sin(t * (active ? 6 : 2.4) + i * 0.9);
      m.color.setRGB(1, 0.78 + on * 0.2, 0.4 + on * 0.45);
    });
    if (still()) return;
    people.current.forEach((g, i) => {
      if (!g) return;
      g.position.x = Math.sin(t * 0.4 + i * 2.1) * 0.7;
      g.position.y = Math.abs(Math.sin(t * 5 + i)) * 0.03;
      g.rotation.y = Math.cos(t * 0.4 + i * 2.1) > 0 ? 0 : Math.PI;
    });
  });
  return (
    <group>
      <Box s={[2.0, 0.02, 1.2]} c="#E8DCC4" shadow={false} />
      {awn.map((c, i) => {
        const x = -0.8 + i * 0.4;
        return (
          <group key={i} position={[x, 0, i % 2 ? 0.35 : -0.35]} rotation={[0, i % 2 ? Math.PI : 0, 0]}>
            <Box s={[0.32, 0.18, 0.26]} c={C.wall} />
            <Box p={[0, 0.18, 0.04]} s={[0.36, 0.03, 0.34]} c={c} />
            <Box p={[0, 0.2, 0.04]} s={[0.12, 0.031, 0.34]} c={C.white} shadow={false} />
            {[-0.13, 0.13].map((px) => <Box key={px} p={[px, 0, 0.17]} s={[0.02, 0.2, 0.02]} c={C.woodDark} shadow={false} />)}
            <Sph p={[0.05, 0.2, -0.02]} s={0.06} c={i % 2 ? C.apricot : C.coral} />
          </group>
        );
      })}
      {/* 串燈 */}
      {bulbList.map((i) => {
        const x = -0.9 + i * (1.8 / 13);
        const y = 0.42 - Math.sin((i / 13) * Math.PI) * 0.08;
        return (
          <mesh key={i} geometry={G.ico} position={[x, y, 0]} scale={0.055}>
            <meshBasicMaterial ref={(m) => { if (m) bulbs.current[i] = m; }} color="#FFE7A0" />
          </mesh>
        );
      })}
      {[-0.95, 0.95].map((x) => <Cyl key={x} p={[x, 0, 0]} s={[0.03, 0.45, 0.03]} c={C.woodDark} shadow={false} />)}
      {/* 逛夜市的人 */}
      {[C.sky, C.coral, C.sage, C.butter].map((c, i) => (
        <group key={i} ref={(g) => { if (g) people.current[i] = g; }} position={[0, 0, (i - 1.5) * 0.08]}>
          <Box p={[0, 0, 0]} s={[0.06, 0.13, 0.06]} c={c} />
          <Sph p={[0, 0.17, 0]} s={0.07} c="#F2D3B6" />
        </group>
      ))}
    </group>
  );
}

// ─────────────────────────── 蝴蝶生態園 ───────────────────────────
function Butterflies({ n = 7, active }: { n?: number; active: boolean }) {
  const list = useMemo(() => Array.from({ length: n }, (_, i) => ({
    c: [C.butter, C.coral, C.sky, C.white, C.mauve, C.apricot][i % 6], a: i * 0.9, r: 0.4 + (i % 3) * 0.22, h: 0.4 + (i % 4) * 0.15, sp: 0.5 + (i % 5) * 0.12,
  })), [n]);
  const refs = useRef<THREE.Group[]>([]);
  const wings = useRef<THREE.Group[]>([]);
  useFrame(({ clock }) => {
    if (still()) return;
    const t = clock.elapsedTime;
    list.forEach((b, i) => {
      const g = refs.current[i];
      if (!g) return;
      const k = t * b.sp * (active ? 1.8 : 1) + b.a;
      const r = b.r * (active ? 1.5 : 1);
      g.position.set(Math.cos(k) * r, b.h + Math.sin(k * 2.3) * 0.15 + (active ? 0.3 : 0), Math.sin(k * 1.3) * r * 0.8);
      g.rotation.y = -k;
      const f = Math.sin(t * 18 + i) * 0.9;
      const l = wings.current[i * 2], rr = wings.current[i * 2 + 1];
      if (l) l.rotation.x = f;
      if (rr) rr.rotation.x = -f;
    });
  });
  return (
    <>
      {list.map((b, i) => (
        <group key={i} ref={(g) => { if (g) refs.current[i] = g; }} scale={0.5}>
          {[1, -1].map((sd, j) => (
            <group key={j} ref={(g) => { if (g) wings.current[i * 2 + j] = g; }}>
              <mesh material={mat(b.c, { side: THREE.DoubleSide })} position={[0, 0, sd * 0.1]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[0.22, 0.2]} />
              </mesh>
            </group>
          ))}
          <Box p={[0, -0.02, 0]} s={[0.2, 0.03, 0.03]} c={C.dark} shadow={false} />
        </group>
      ))}
    </>
  );
}

function Butterfly({ active }: ModelProps) {
  const flowers = useMemo(() => Array.from({ length: 18 }, (_, i) => {
    const a = i * 2.4, r = 0.35 + (i % 4) * 0.17;
    return { p: [Math.cos(a) * r, 0.04, Math.sin(a) * r * 0.8] as Vec3, c: [C.coral, C.butter, C.mauve, C.white, C.apricot][i % 5] };
  }), []);
  return (
    <group>
      <Cyl s={[1.7, 0.04, 1.4]} c="#B8D98F" />
      {flowers.map((f, i) => (
        <group key={i} position={f.p}>
          <Cyl s={[0.02, 0.1, 0.02]} c={C.leaf3} shadow={false} />
          <Ico p={[0, 0.12, 0]} s={0.09} c={f.c} />
        </group>
      ))}
      {/* 網室溫室 */}
      <group position={[-0.45, 0, -0.35]}>
        <Dome s={[0.6, 0.55, 0.6]} c="#D8EEE6" m={mat('#D8EEE6', { transparent: true, opacity: 0.55 })} />
        <Box s={[0.1, 0.18, 0.02]} p={[0, 0, 0.3]} c={C.wood} shadow={false} />
      </group>
      <Butterflies active={active} />
    </group>
  );
}

// ─────────────────────────── 仙草田（仙圃企業） ───────────────────────────
function HerbFarm({ active }: ModelProps) {
  const rows = useMemo(() => {
    const out: Vec3[] = [];
    for (let i = 0; i < 5; i++) for (let j = 0; j < 6; j++) out.push([0.05 + j * 0.16, 0.04, -0.4 + i * 0.2]);
    return out;
  }, []);
  return (
    <group>
      <Box p={[0.45, 0, -0.0]} s={[1.05, 0.05, 1.05]} c="#8A6B4E" shadow={false} />
      {rows.map((p, i) => (
        <mesh key={i} geometry={G.cone} material={windMat('#4E8A4E', 0.06, 2)} position={p} scale={[0.13, 0.18, 0.13]} castShadow />
      ))}
      <House p={[-0.5, 0, 0]} w={0.6} d={0.55} h={0.4} roof={C.sage} r={Math.PI / 2} />
      {/* 熬煮仙草的大鍋 */}
      <Cyl p={[-0.5, 0, 0.5]} s={[0.26, 0.16, 0.26]} c={C.dark} />
      <Cyl p={[-0.5, 0.16, 0.5]} s={[0.22, 0.01, 0.22]} c="#2E2620" shadow={false} />
      <Puffs p={[-0.5, 0.22, 0.5]} count={3} size={0.1} rise={0.6} speed={0.4} boost={active} />
    </group>
  );
}

// ─────────────────────────── 青木堂（蔬果） ───────────────────────────
function Fruit({ active }: ModelProps) {
  const crates: [number, string][] = [[-0.3, '#F29E4C'], [-0.05, '#F3D67A'], [0.2, '#B8D46A'], [0.45, '#F2B880']];
  return (
    <group>
      <House w={0.9} d={0.55} h={0.42} roof={C.sage} wall={C.wall} />
      <Box p={[0, 0.34, 0.38]} s={[0.95, 0.03, 0.26]} c={C.leaf} />
      {crates.map(([x, c], i) => (
        <group key={i} position={[x - 0.08, 0, 0.55]}>
          <Box s={[0.2, 0.08, 0.16]} c={C.wood} />
          <Bob p={[0, 0.11, 0]} amp={active ? 0.06 : 0.015} speed={3} phase={i}>
            <Sph p={[-0.04, 0, 0]} s={0.08} c={c} />
            <Sph p={[0.05, 0, 0.02]} s={0.08} c={c} />
          </Bob>
        </group>
      ))}
      <group position={[0.65, 0, -0.1]}>
        <Cyl s={[0.05, 0.5, 0.05]} c={C.trunk} />
        <Ico p={[0, 0.6, 0]} s={0.4} c={C.leaf2} m={windMat(C.leaf2, 0.05)} />
        <Sph p={[0.08, 0.45, 0.12]} s={0.08} c="#F29E4C" />
      </group>
    </group>
  );
}

// ─────────────────────────── 農會 ───────────────────────────
function Coop({ active }: ModelProps) {
  return (
    <group>
      <Box s={[0.8, 0.7, 0.55]} c={C.wall} />
      <Box p={[0, 0.7, 0]} s={[0.84, 0.06, 0.59]} c={C.sage} />
      <Windows y={0.42} z={0.28} xs={[-0.25, 0, 0.25]} />
      <Windows y={0.18} z={0.28} xs={[-0.25, 0.25]} />
      <Box p={[0, 0.55, 0.285]} s={[0.5, 0.1, 0.02]} c={C.leaf3} shadow={false} />
      <group position={[0.6, 0, -0.05]}>
        <Cyl s={[0.3, 0.75, 0.3]} c={C.stone} />
        <Cone p={[0, 0.75, 0]} s={[0.34, 0.2, 0.34]} c={C.coral} />
      </group>
      <Bob p={[-0.55, 0.05, 0.2]} amp={active ? 0.06 : 0.02} speed={2.4}>
        <Box s={[0.16, 0.12, 0.12]} c={C.butter} />
        <Box p={[0, 0, 0.18]} s={[0.16, 0.12, 0.12]} c={C.wall2} />
      </Bob>
    </group>
  );
}

// ─────────────────────────── 工作室 ───────────────────────────
function Studio({ active }: ModelProps) {
  return (
    <group>
      <House w={0.6} d={0.5} h={0.4} roof={C.mauve} wall={C.wall} />
      {/* 曬仙草麵的架子 */}
      <group position={[0.48, 0, 0.1]}>
        {[-0.12, 0.12].map((z) => <Box key={z} p={[0, 0, z]} s={[0.02, 0.3, 0.02]} c={C.woodDark} shadow={false} />)}
        <Box p={[0, 0.29, 0]} s={[0.02, 0.02, 0.28]} c={C.woodDark} shadow={false} />
        {[-0.08, 0, 0.08].map((z, i) => (
          <Swing key={z} p={[0, 0.28, z]} amp={active ? 0.35 : 0.1} speed={2.2} phase={i}>
            <Box p={[0, -0.08, 0]} s={[0.05, 0.16, 0.02]} c="#3E3A36" shadow={false} />
          </Swing>
        ))}
      </group>
      <Cyl p={[-0.38, 0, 0.32]} s={[0.12, 0.1, 0.12]} c={C.coral} />
      <Ico p={[-0.38, 0.16, 0.32]} s={0.15} c={C.leaf} />
    </group>
  );
}

// ─────────────────────────── 在地小吃店 ───────────────────────────
function Shop({ kind, active }: ModelProps & { kind: Model }) {
  const roof = { duck: C.coral, cafe: C.sage, bakery: C.apricot, rice: C.butter, shop: C.sky }[kind as string] || C.sky;
  return (
    <group>
      <Box s={[0.55, 0.42, 0.45]} c={C.wall} />
      <Box p={[0, 0.42, 0]} s={[0.58, 0.05, 0.48]} c={roof} />
      <Box p={[0, 0.27, 0.3]} s={[0.58, 0.03, 0.16]} c={roof} r={[0.35, 0, 0]} />
      <Box p={[0, 0.05, 0.226]} s={[0.36, 0.2, 0.02]} c={C.glass} shadow={false} />
      <Bob p={[0, 0.62, 0]} amp={active ? 0.08 : 0.025} speed={active ? 5 : 1.7}>
        <Spin speed={0.7} fast={active}>
          {kind === 'duck' && <><Sph s={[0.26, 0.18, 0.18]} c="#C9783F" /><Sph p={[0.14, 0.08, 0]} s={0.1} c="#C9783F" /></>}
          {kind === 'cafe' && <><Cyl p={[0, -0.08, 0]} s={[0.18, 0.16, 0.18]} c={C.white} /><mesh geometry={G.torus} material={mat(C.white)} position={[0.11, 0, 0]} scale={[0.08, 0.08, 0.2]} /></>}
          {kind === 'bakery' && <mesh geometry={G.torus} material={mat('#E3A55A')} rotation={[Math.PI / 2, 0, 0]} scale={[0.2, 0.2, 0.45]} />}
          {kind === 'rice' && <><Dome p={[0, -0.06, 0]} r={[Math.PI, 0, 0]} s={[0.26, 0.18, 0.26]} c={C.white} /><Ico p={[0, -0.05, 0]} s={[0.22, 0.08, 0.22]} c="#FFF6E0" /></>}
          {kind === 'shop' && <Ico s={0.18} c={C.butter} />}
        </Spin>
      </Bob>
    </group>
  );
}

// ─────────────────────────── 車站 ───────────────────────────
function Station() {
  return (
    <group>
      <Box s={[0.9, 0.36, 0.45]} c={C.wall} />
      <Roof p={[0, 0.36, 0]} s={[0.55, 0.22, 1.0]} c={C.sky} r={[0, Math.PI / 2, 0]} />
      <Windows y={0.16} z={0.23} xs={[-0.28, 0.28]} />
      <Box p={[0, 0, 0.23]} s={[0.16, 0.24, 0.02]} c={C.woodDark} shadow={false} />
      <Cyl p={[0, 0.48, 0.25]} r={[Math.PI / 2, 0, 0]} s={[0.14, 0.03, 0.14]} c={C.white} />
      <Box p={[0, 0, -0.42]} s={[1.3, 0.08, 0.3]} c={C.stone} />
      {[-0.5, 0, 0.5].map((x) => <Box key={x} p={[x, 0.08, -0.48]} s={[0.03, 0.26, 0.03]} c={C.dark} shadow={false} />)}
      <Box p={[0, 0.34, -0.45]} s={[1.3, 0.03, 0.3]} c={C.sky} />
    </group>
  );
}

// ─────────────────────────── 機場 ───────────────────────────
function Airport({ active }: ModelProps) {
  const beacon = useRef<THREE.Group>(null!);
  useFrame((_, dt) => { if (!still()) beacon.current.rotation.y += dt * (active ? 6 : 2); });
  return (
    <group>
      <Box p={[0, 0, 0.75]} s={[2.4, 0.02, 0.36]} c="#A9A6A0" shadow={false} />
      {[-1, -0.6, -0.2, 0.2, 0.6, 1].map((x) => <Box key={x} p={[x, 0.021, 0.75]} s={[0.2, 0.005, 0.03]} c={C.white} shadow={false} />)}
      {/* 機庫 */}
      <group position={[-0.5, 0, -0.1]}>
        <mesh position={[0, 0, 0]} rotation={[0, 0, 0]} castShadow receiveShadow material={mat('#DCE3EA')}>
          <cylinderGeometry args={[0.38, 0.38, 0.9, 8, 1, false, -Math.PI / 2, Math.PI]} />
        </mesh>
        <Box p={[0, -0.38, 0]} s={[0.76, 0.38, 0.9]} c="#DCE3EA" />
      </group>
      {/* 塔台 */}
      <group position={[0.55, 0, -0.15]}>
        <Cyl s={[0.2, 0.9, 0.2]} c={C.wall} />
        <Cyl6 p={[0, 0.9, 0]} s={[0.4, 0.22, 0.4]} c={C.glass} />
        <Cyl6 p={[0, 1.12, 0]} s={[0.46, 0.05, 0.46]} c={C.coral} />
        <group ref={beacon} position={[0, 1.18, 0]}>
          <Box p={[0.06, 0.04, 0]} s={[0.12, 0.05, 0.05]} c="#FFE08A" m={mat('#FFE08A', { emissive: '#F6C453' })} />
        </group>
      </group>
      {/* 停機坪的小飛機 */}
      <group position={[0.25, 0.08, 0.38]} rotation={[0, 0.3, 0]} scale={0.7}>
        <Box s={[0.7, 0.13, 0.13]} c={C.white} />
        <Box p={[0.05, 0.05, 0]} s={[0.2, 0.03, 0.9]} c={C.sky} />
        <Box p={[-0.3, 0.1, 0]} s={[0.1, 0.18, 0.03]} c={C.sky} />
      </group>
    </group>
  );
}

// ─────────────────────────── 八掌溪：木橋與小船 ───────────────────────────
function Bridge({ active }: ModelProps) {
  return (
    <group>
      {[-0.42, -0.14, 0.14, 0.42].map((x, i) => (
        <Box key={x} p={[x, 0.03 + Math.sin(((i + 0.5) / 4) * Math.PI) * 0.12, 0]} s={[0.29, 0.05, 0.32]} c={C.wood} />
      ))}
      {[-0.17, 0.17].map((z) => (
        <Box key={z} p={[0, 0.2, z]} s={[1.1, 0.03, 0.03]} c={C.woodDark} shadow={false} />
      ))}
      {[-0.5, 0.5].map((x) => [-0.17, 0.17].map((z) => <Box key={x + '' + z} p={[x, 0, z]} s={[0.04, 0.22, 0.04]} c={C.woodDark} shadow={false} />))}
      <Bob p={[0.15, 0.04, 0.6]} amp={0.03} speed={active ? 3 : 1.3}>
        <group rotation={[0, 0.4, 0]}>
          <Box s={[0.42, 0.07, 0.16]} c={C.coral} />
          <Box p={[0, 0.07, 0]} s={[0.3, 0.02, 0.12]} c={C.wall} shadow={false} />
        </group>
      </Bob>
    </group>
  );
}

/** 景點模型（含標籤高度、點擊範圍）。 */
export const MODELS: Record<Model, { h: number; r: number; C: (p: ModelProps & { kind: Model }) => JSX.Element }> = {
  tropic: { h: 2.5, r: 0.6, C: Tropic },
  space: { h: 2.3, r: 0.8, C: Space },
  sugar: { h: 2.3, r: 0.95, C: Sugar },
  coffee: { h: 1.45, r: 0.75, C: Coffee },
  mansion: { h: 1.0, r: 0.8, C: Mansion },
  temple: { h: 1.3, r: 0.7, C: Temple },
  market: { h: 0.8, r: 1.0, C: Market },
  butterfly: { h: 1.2, r: 0.85, C: Butterfly },
  herbfarm: { h: 0.9, r: 0.85, C: HerbFarm },
  fruit: { h: 1.1, r: 0.7, C: Fruit },
  coop: { h: 1.05, r: 0.6, C: Coop },
  studio: { h: 0.8, r: 0.5, C: Studio },
  duck: { h: 0.95, r: 0.42, C: Shop },
  cafe: { h: 0.95, r: 0.42, C: Shop },
  bakery: { h: 0.95, r: 0.42, C: Shop },
  rice: { h: 0.95, r: 0.42, C: Shop },
  shop: { h: 0.95, r: 0.42, C: Shop },
  station: { h: 0.9, r: 0.65, C: Station },
  airport: { h: 1.5, r: 1.1, C: Airport },
  bridge: { h: 0.6, r: 0.6, C: Bridge },
};
