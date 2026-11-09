// 一天的光線：清晨、白天、黃昏、夜晚。時間會自己流動，也可以停在某個時段。
// 太陽（夜裡是月光）的顏色、角度、天空背景，以及夜晚亮起的窗戶與路燈，都跟著時間變。
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore, frozen } from '../store';
import { NIGHT, mat, C } from './kit';

interface Key { t: number; sun: string; si: number; sky: string; gnd: string; hi: number; amb: number; bg1: string; bg2: string; night: number }
const KEYS: Key[] = [
  { t: 0.0, sun: '#9DB2E6', si: 0.55, sky: '#55689A', gnd: '#2F3650', hi: 0.7, amb: 0.18, bg1: '#2E3A5E', bg2: '#1B2238', night: 1 },
  { t: 0.15, sun: '#9DB2E6', si: 0.55, sky: '#55689A', gnd: '#2F3650', hi: 0.7, amb: 0.18, bg1: '#2E3A5E', bg2: '#1B2238', night: 1 },
  { t: 0.22, sun: '#FFC7A0', si: 1.25, sky: '#FFE1CB', gnd: '#B8B39A', hi: 1.0, amb: 0.22, bg1: '#FDE3CC', bg2: '#E9C9B4', night: 0.25 },
  { t: 0.32, sun: '#FFF1D8', si: 1.9, sky: '#FFF7E6', gnd: '#C9D9B0', hi: 1.25, amb: 0.25, bg1: '#FFF8E6', bg2: '#F3E2B8', night: 0 },
  { t: 0.66, sun: '#FFF1D8', si: 1.9, sky: '#FFF7E6', gnd: '#C9D9B0', hi: 1.25, amb: 0.25, bg1: '#FFF8E6', bg2: '#F3E2B8', night: 0 },
  { t: 0.78, sun: '#FFAE72', si: 1.45, sky: '#FFD2AE', gnd: '#A99C86', hi: 0.95, amb: 0.22, bg1: '#FBD3B0', bg2: '#E7A988', night: 0.35 },
  { t: 0.86, sun: '#9DB2E6', si: 0.55, sky: '#55689A', gnd: '#2F3650', hi: 0.7, amb: 0.18, bg1: '#2E3A5E', bg2: '#1B2238', night: 1 },
  { t: 1.0, sun: '#9DB2E6', si: 0.55, sky: '#55689A', gnd: '#2F3650', hi: 0.7, amb: 0.18, bg1: '#2E3A5E', bg2: '#1B2238', night: 1 },
];
const ca = new THREE.Color(), cb = new THREE.Color();
const mix = (a: string, b: string, k: number) => ca.set(a).lerp(cb.set(b), k).getStyle();
function sample(t: number) {
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].t <= t) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const k = THREE.MathUtils.smoothstep(t, a.t, b.t);
  const n = (x: number, y: number) => x + (y - x) * k;
  return {
    sun: mix(a.sun, b.sun, k), si: n(a.si, b.si), sky: mix(a.sky, b.sky, k), gnd: mix(a.gnd, b.gnd, k),
    hi: n(a.hi, b.hi), amb: n(a.amb, b.amb), bg1: mix(a.bg1, b.bg1, k), bg2: mix(a.bg2, b.bg2, k), night: n(a.night, b.night),
  };
}

/** 一整天（自動流動時）大約幾秒 */
const DAY_SECONDS = 300;

export function Lighting({ shadow }: { shadow: number }) {
  const sun = useRef<THREE.DirectionalLight>(null!);
  const hemi = useRef<THREE.HemisphereLight>(null!);
  const amb = useRef<THREE.AmbientLight>(null!);
  const shown = useRef(-1);
  useFrame((_, dt) => {
    const st = useStore.getState();
    let t = st.time;
    if (!st.timeLock && !frozen()) {
      t = (t + Math.min(dt, 0.1) / DAY_SECONDS) % 1;
      st.set({ time: t });
    }
    // 切換時段時平滑過渡，不要一下子跳過去
    const target = t;
    if (shown.current < 0) shown.current = target;
    let d = target - shown.current;
    if (d > 0.5) d -= 1; else if (d < -0.5) d += 1;
    shown.current = (shown.current + d * Math.min(1, dt * 3) + 1) % 1;
    const now = shown.current;
    const s = sample(now);

    // 太陽從東（+x）升起、西（-x）落下；夜裡換成高掛的月光
    const a = (now - 0.25) * Math.PI * 2;
    const up = Math.sin(a);
    if (up > -0.05) sun.current.position.set(Math.cos(a) * 28, 9 + Math.max(up, 0) * 20, 14);
    else sun.current.position.set(-10, 26, 12);
    sun.current.color.set(s.sun);
    sun.current.intensity = s.si;
    hemi.current.color.set(s.sky);
    hemi.current.groundColor.set(s.gnd);
    hemi.current.intensity = s.hi;
    amb.current.intensity = s.amb;
    NIGHT.value = s.night;

    const el = document.querySelector<HTMLElement>('.isl-stage');
    if (el) { el.style.setProperty('--sky1', s.bg1); el.style.setProperty('--sky2', s.bg2); }
    // 建築上的窗戶在夜裡亮起
    (mat(C.glass) as THREE.MeshLambertMaterial).emissive.setRGB(s.night * 0.95, s.night * 0.7, s.night * 0.3);
    (mat(C.butter) as THREE.MeshLambertMaterial).emissive.setRGB(s.night * 0.5, s.night * 0.35, s.night * 0.1);
  });
  return (
    <>
      <hemisphereLight ref={hemi} args={['#FFF7E6', '#C9D9B0', 1.25]} />
      <directionalLight
        ref={sun}
        position={[14, 26, 16]}
        intensity={1.9}
        color="#FFF1D8"
        castShadow
        shadow-mapSize={[shadow, shadow]}
        shadow-camera-left={-24}
        shadow-camera-right={24}
        shadow-camera-top={16}
        shadow-camera-bottom={-16}
        shadow-camera-near={1}
        shadow-camera-far={90}
        shadow-bias={-0.0008}
        shadow-normalBias={0.03}
      />
      <ambientLight ref={amb} intensity={0.25} />
    </>
  );
}

/** 夜裡亮起的路燈（沿主要道路）。燈泡材質的亮度跟著 NIGHT 變。 */
export function StreetLamps({ spots }: { spots: { x: number; z: number }[] }) {
  const pole = useRef<THREE.InstancedMesh>(null!);
  const bulb = useRef<THREE.InstancedMesh>(null!);
  const glow = useMemo(() => new THREE.MeshBasicMaterial({ color: '#E9E2D2' }), []);
  const halo = useMemo(() => new THREE.MeshBasicMaterial({ color: '#FFD27A', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }), []);
  const haloRef = useRef<THREE.InstancedMesh>(null!);
  const day = useMemo(() => new THREE.Color('#E9E2D2'), []), night = useMemo(() => new THREE.Color('#FFD27A'), []);
  const placed = useRef(false);
  useFrame(() => {
    if (!placed.current && pole.current) {
      const o = new THREE.Object3D();
      spots.forEach((p, i) => {
        o.position.set(p.x, 0.21, p.z); o.scale.set(0.025, 0.42, 0.025); o.updateMatrix(); pole.current.setMatrixAt(i, o.matrix);
        o.position.set(p.x, 0.42, p.z); o.scale.setScalar(0.07); o.updateMatrix(); bulb.current.setMatrixAt(i, o.matrix);
        o.position.set(p.x, 0.4, p.z); o.scale.setScalar(0.42); o.updateMatrix(); haloRef.current.setMatrixAt(i, o.matrix);
      });
      for (const m of [pole.current, bulb.current, haloRef.current]) m.instanceMatrix.needsUpdate = true;
      placed.current = true;
    }
    glow.color.copy(day).lerp(night, NIGHT.value);
    halo.opacity = NIGHT.value * 0.35;
  });
  return (
    <>
      <instancedMesh ref={pole} args={[undefined, mat('#6B6F7A'), spots.length]}>
        <cylinderGeometry args={[0.5, 0.5, 1, 5]} />
      </instancedMesh>
      <instancedMesh ref={bulb} args={[undefined, glow, spots.length]}>
        <icosahedronGeometry args={[0.5, 0]} />
      </instancedMesh>
      <instancedMesh ref={haloRef} args={[undefined, halo, spots.length]}>
        <icosahedronGeometry args={[0.5, 1]} />
      </instancedMesh>
    </>
  );
}
