// 交通：沿道路來回的汽車與公車、騎單車的人、縱貫線火車、繞島飛行的小飛機。
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { World } from '../world';
import { BOUNDS } from '../geo';
import { Box, C, Sph, G, mat } from './kit';
import { useStore } from '../store';

const tmp = new THREE.Vector3();
const tan = new THREE.Vector3();

/** 讓物件沿曲線來回移動（到端點掉頭），靠右行駛。 */
function useAlong(curve: THREE.Curve<THREE.Vector3>, speed: number, offset: number, lane: number, y = 0) {
  const ref = useRef<THREE.Group>(null!);
  const len = useMemo(() => curve.getLength(), [curve]);
  const state = useRef({ s: offset * len * 2 });
  useFrame((_, dt) => {
    const st = useStore.getState();
    if (st.reduced) return;
    state.current.s = (state.current.s + Math.min(dt, 0.1) * speed) % (len * 2);
    const s = state.current.s;
    const fwd = s < len;
    const u = THREE.MathUtils.clamp(fwd ? s / len : 2 - s / len, 0, 1);
    curve.getPointAt(u, tmp);
    curve.getTangentAt(u, tan);
    if (!fwd) tan.negate();
    const g = ref.current;
    g.position.set(tmp.x - tan.z * lane, y, tmp.z + tan.x * lane);
    g.rotation.y = Math.atan2(-tan.z, tan.x);
  });
  return ref;
}

const CAR_COLORS = ['#E8826A', '#79A9CF', '#F3D67A', '#86B89C', '#FFFFFF', '#C597BE', '#F2B880'];

function Car({ curve, speed, offset, color }: { curve: THREE.Curve<THREE.Vector3>; speed: number; offset: number; color: string }) {
  const ref = useAlong(curve, speed, offset, 0.075, 0.03);
  return (
    <group ref={ref}>
      <group scale={0.8}>
        <Box p={[0, 0.04, 0]} s={[0.34, 0.1, 0.18]} c={color} />
        <Box p={[-0.02, 0.14, 0]} s={[0.18, 0.09, 0.16]} c={C.glass} />
        <Box p={[0.11, 0, 0]} s={[0.07, 0.06, 0.2]} c={C.dark} shadow={false} />
        <Box p={[-0.11, 0, 0]} s={[0.07, 0.06, 0.2]} c={C.dark} shadow={false} />
      </group>
    </group>
  );
}

function Bus({ curve, speed, offset }: { curve: THREE.Curve<THREE.Vector3>; speed: number; offset: number }) {
  const ref = useAlong(curve, speed, offset, 0.085, 0.03);
  return (
    <group ref={ref} scale={0.85}>
      <Box p={[0, 0.04, 0]} s={[0.62, 0.22, 0.2]} c="#F2C14E" />
      <Box p={[0, 0.17, 0]} s={[0.6, 0.06, 0.205]} c={C.glass} shadow={false} />
      <Box p={[0, 0.26, 0]} s={[0.62, 0.03, 0.2]} c={C.white} />
      <Box p={[0.2, 0, 0]} s={[0.08, 0.06, 0.22]} c={C.dark} shadow={false} />
      <Box p={[-0.2, 0, 0]} s={[0.08, 0.06, 0.22]} c={C.dark} shadow={false} />
    </group>
  );
}

/** 騎單車的人：輪子轉、腳踩踏板。 */
function Bike({ curve, speed, offset, shirt }: { curve: THREE.Curve<THREE.Vector3>; speed: number; offset: number; shirt: string }) {
  const ref = useAlong(curve, speed, offset, 0.14, 0.03);
  const wheels = useRef<THREE.Mesh[]>([]);
  const legs = useRef<THREE.Group>(null!);
  useFrame(({ clock }) => {
    if (useStore.getState().reduced) return;
    const t = clock.elapsedTime * speed * 22;
    wheels.current.forEach((w) => w && (w.rotation.z = -t));
    if (legs.current) legs.current.rotation.z = Math.sin(t) * 0.5;
  });
  return (
    <group ref={ref} scale={0.75}>
      {[0.1, -0.1].map((x, i) => (
        <mesh key={i} ref={(m) => { if (m) wheels.current[i] = m; }} geometry={G.torus} material={mat(C.dark)}
          position={[x, 0.07, 0]} scale={[0.14, 0.14, 0.4]} />
      ))}
      <Box p={[0, 0.07, 0]} s={[0.2, 0.025, 0.02]} c={C.red} shadow={false} />
      <Box p={[-0.02, 0.1, 0]} s={[0.07, 0.15, 0.06]} c={shirt} />
      <Sph p={[-0.01, 0.3, 0]} s={0.07} c="#F2D3B6" />
      <Box p={[-0.01, 0.335, 0]} s={[0.075, 0.025, 0.075]} c={C.coral} shadow={false} />
      <group ref={legs} position={[-0.02, 0.1, 0]}>
        <Box p={[0.02, -0.06, 0]} s={[0.03, 0.08, 0.03]} c={C.sky} shadow={false} />
      </group>
    </group>
  );
}

/** 縱貫線火車：沿著真實鐵道路線往返，到端點前會減速。 */
function Train({ curve }: { curve: THREE.Curve<THREE.Vector3> }) {
  const cars = useRef<THREE.Group[]>([]);
  const len = useMemo(() => curve.getLength(), [curve]);
  const clock = useRef(0);
  const N = 4, gap = 0.62;
  useFrame((_, dt) => {
    if (useStore.getState().reduced) return;
    clock.current += Math.min(dt, 0.1);
    const period = 34;
    const ph = (clock.current % period) / period; // 0→1
    const head = 0.5 - 0.5 * Math.cos(ph * Math.PI * 2); // 平滑來回
    const dir = ph < 0.5 ? 1 : -1;
    const span = (N * gap) / len;
    for (let i = 0; i < N; i++) {
      const base = head * (1 - span), off = (i * gap) / len;
      const u = THREE.MathUtils.clamp(dir > 0 ? base + span - off : base + off, 0, 1);
      curve.getPointAt(u, tmp);
      curve.getTangentAt(u, tan);
      const g = cars.current[i];
      if (!g) continue;
      g.position.set(tmp.x, 0.07, tmp.z);
      g.rotation.y = Math.atan2(-tan.z, tan.x);
    }
  });
  return (
    <>
      {Array.from({ length: N }, (_, i) => (
        <group key={i} ref={(g) => { if (g) cars.current[i] = g; }}>
          <Box p={[0, 0, 0]} s={[0.56, 0.2, 0.2]} c={i === 0 ? '#F2B880' : C.wall} />
          <Box p={[0, 0.08, 0]} s={[0.5, 0.06, 0.205]} c={C.glass} shadow={false} />
          <Box p={[0, 0.03, 0]} s={[0.565, 0.03, 0.205]} c={i === 0 ? C.coral : C.sky} shadow={false} />
          <Box p={[0, 0.2, 0]} s={[0.54, 0.025, 0.16]} c={C.stone} shadow={false} />
        </group>
      ))}
    </>
  );
}

/** 從水上機場起飛的小飛機，繞島嶼緩緩飛行。 */
function Plane() {
  const ref = useRef<THREE.Group>(null!);
  const prop = useRef<THREE.Mesh>(null!);
  const cx = (BOUNDS.minX + BOUNDS.maxX) / 2, cz = (BOUNDS.minZ + BOUNDS.maxZ) / 2;
  const rx = (BOUNDS.maxX - BOUNDS.minX) / 2 + 1, rz = (BOUNDS.maxZ - BOUNDS.minZ) / 2 + 1.5;
  useFrame(({ clock }) => {
    if (useStore.getState().reduced) return;
    const t = clock.elapsedTime * 0.06;
    const x = cx + Math.cos(t) * rx, z = cz + Math.sin(t) * rz;
    const dx = -Math.sin(t) * rx, dz = Math.cos(t) * rz;
    ref.current.position.set(x, 4.2 + Math.sin(t * 3) * 0.3, z);
    ref.current.rotation.set(0, Math.atan2(-dz, dx), 0);
    ref.current.rotateX(-0.25);
    prop.current.rotation.x = clock.elapsedTime * 30;
  });
  return (
    <group ref={ref} scale={0.9}>
      <Box p={[0, -0.08, 0]} s={[0.8, 0.16, 0.16]} c={C.white} />
      <Box p={[0.05, -0.02, 0]} s={[0.22, 0.04, 1.0]} c={C.coral} />
      <Box p={[-0.36, 0, 0]} s={[0.12, 0.2, 0.04]} c={C.coral} />
      <Box p={[-0.36, -0.02, 0]} s={[0.1, 0.03, 0.34]} c={C.white} />
      <Box p={[0.12, 0.0, 0]} s={[0.16, 0.06, 0.14]} c={C.glass} shadow={false} />
      <mesh ref={prop} geometry={G.box} material={mat(C.dark)} position={[0.42, -0.08, 0]} scale={[0.02, 0.04, 0.3]} />
    </group>
  );
}

export function Traffic({ world }: { world: World }) {
  const byName = (n: string) => world.roads.find((r) => r.name === n)?.curve;
  const list = useMemo(() => {
    const cars: { curve: THREE.CatmullRomCurve3; speed: number; offset: number; color: string }[] = [];
    let k = 0;
    world.roads.forEach((r) => {
      const n = r.main ? 3 : 1;
      for (let i = 0; i < n; i++) cars.push({ curve: r.curve, speed: 0.55 + ((k * 7) % 5) * 0.08, offset: (i / n + k * 0.13) % 1, color: CAR_COLORS[k++ % CAR_COLORS.length] });
    });
    return cars;
  }, [world]);
  const t1 = byName('台1線'), r168 = byName('縣道168'), ns = byName('南靖路'), ap = byName('機場路');
  return (
    <>
      {list.map((c, i) => <Car key={i} {...c} />)}
      {t1 && <Bus curve={t1} speed={0.5} offset={0.3} />}
      {r168 && <Bus curve={r168} speed={0.45} offset={0.7} />}
      {r168 && <Bike curve={r168} speed={0.16} offset={0.42} shirt={C.butter} />}
      {ns && <Bike curve={ns} speed={0.14} offset={0.1} shirt={C.sage} />}
      {ap && <Bike curve={ap} speed={0.15} offset={0.6} shirt={C.mauve} />}
      {world.rail && <Train curve={world.rail} />}
      <Plane />
    </>
  );
}
