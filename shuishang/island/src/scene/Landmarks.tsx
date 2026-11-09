// 景點建築的互動外殼：待機微動、滑過浮起放大、點擊彈跳、選中高亮、分類篩選時下沉。
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import { CAT, type Poi } from '../data';
import { useStore } from '../store';
import { MODELS } from './models';
import { G } from './kit';
import type { World } from '../world';

const damp = THREE.MathUtils.damp;

function Landmark({ poi, index, y0 }: { poi: Poi; index: number; y0: number }) {
  const spec = MODELS[poi.model];
  const Model = spec.C;
  const lift = useRef<THREE.Group>(null!);
  const pop = useRef<THREE.Group>(null!);
  const ring = useRef<THREE.Mesh>(null!);
  const ringMat = useMemo(() => new THREE.MeshBasicMaterial({ color: CAT[poi.cat].color, transparent: true, opacity: 0, depthWrite: false }), [poi.cat]);
  const discMat = useMemo(() => new THREE.MeshBasicMaterial({ color: CAT[poi.cat].color, transparent: true, opacity: 0, depthWrite: false }), [poi.cat]);

  const selected = useStore((s) => s.selected === poi.id);
  const hovered = useStore((s) => s.hovered === poi.id);
  const filtered = useStore((s) => s.filter !== 'all' && s.filter !== poi.cat);
  const lit = useStore((s) => s.filter === poi.cat);
  const pulse = useStore((s) => s.pulse[poi.id] || 0);
  const closeUp = useStore((s) => s.closeUp);
  const tripNo = useStore((s) => s.trip.indexOf(poi.id) + 1);
  const crowded = useStore((s) => s.hidden.includes(poi.id));
  // 有些建築的待機動畫比較明顯，有些幾乎不動——讓整座島的動態有層次，不會同時一起晃
  const idle = useMemo(() => ({ amp: [0.02, 0.0, 0.035, 0.012][index % 4], speed: 0.8 + (index % 5) * 0.17, phase: index * 1.7 }), [index]);

  // 點擊：擠壓 → 彈起 → 回彈
  useEffect(() => {
    if (!pulse || useStore.getState().reduced) return;
    const s = pop.current.scale;
    const tl = gsap.timeline();
    tl.to(s, { x: 1.14, y: 0.8, z: 1.14, duration: 0.11, ease: 'power2.out' })
      .to(s, { x: 0.93, y: 1.2, z: 0.93, duration: 0.15, ease: 'power2.out' })
      .to(s, { x: 1, y: 1, z: 1, duration: 0.7, ease: 'elastic.out(1.1, 0.4)' });
    return () => { tl.kill(); };
  }, [pulse]);

  useFrame(({ clock }, dt) => {
    const st = useStore.getState();
    const t = clock.elapsedTime;
    const bob = st.reduced ? 0 : Math.sin(t * idle.speed + idle.phase) * idle.amp;
    const ty = (selected ? 0.3 : hovered ? 0.16 : filtered ? -0.12 : 0) + bob;
    const ts = selected ? 1.1 : hovered ? 1.07 : filtered ? 0.82 : 1;
    const g = lift.current;
    g.position.y = damp(g.position.y, ty, 9, dt);
    const sc = damp(g.scale.x, ts, 9, dt);
    g.scale.setScalar(sc);
    // 腳下的光圈：選中時呼吸、滑過時淡淡出現、篩選到這一類時常亮
    const tr = selected ? 0.85 : hovered ? 0.55 : lit ? 0.38 : 0;
    ringMat.opacity = damp(ringMat.opacity, tr, 8, dt);
    discMat.opacity = damp(discMat.opacity, selected ? 0.16 : lit ? 0.1 : 0, 8, dt);
    const k = selected && !st.reduced ? 1 + Math.sin(t * 3) * 0.06 : 1;
    ring.current.scale.setScalar(spec.r * 2.3 * k);
  });

  const over = (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); useStore.getState().hover(poi.id); document.body.style.cursor = 'pointer'; };
  const out = () => { if (useStore.getState().hovered === poi.id) useStore.getState().hover(null); document.body.style.cursor = ''; };
  const click = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return; // 拖曳旋轉後放開，不算點擊
    e.stopPropagation();
    const s = useStore.getState();
    s.set({ touring: false });
    s.select(poi.id);
  };

  const showLabel = selected || hovered || (!filtered && !crowded && (!poi.minor || closeUp || tripNo > 0));
  return (
    <group position={[poi.pos[0], y0, poi.pos[1]]}>
      <mesh ref={ring} geometry={G.ring} material={ringMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} />
      <mesh material={discMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]} scale={spec.r * 2.2}>
        <circleGeometry args={[0.5, 32]} />
      </mesh>
      <group ref={lift} onPointerOver={over} onPointerOut={out} onClick={click}>
        <group ref={pop}>
          <group rotation={[0, poi.rot || 0, 0]}>
            <Model active={selected} pulse={pulse} kind={poi.model} />
          </group>
        </group>
        {/* 透明的點擊範圍，小建築也好點 */}
        <mesh visible={false} position={[0, spec.h / 2, 0]} scale={[spec.r * 2, spec.h, spec.r * 2]} geometry={G.cyl} />
      </group>
      {showLabel && (
        <Html position={[0, spec.h + 0.15, 0]} center zIndexRange={[30, 10]} className="isl-label-wrap">
          <button
            type="button"
            className={'isl-label' + (selected ? ' is-on' : '') + (poi.minor ? ' is-minor' : '')}
            style={{ '--acc': CAT[poi.cat].color } as React.CSSProperties}
            onClick={() => { useStore.getState().set({ touring: false }); useStore.getState().select(poi.id); }}
            onPointerEnter={() => useStore.getState().hover(poi.id)}
            onPointerLeave={() => useStore.getState().hover(null)}
          >
            {tripNo > 0 && <b className="isl-label-no">{tripNo}</b>}
            <i>{CAT[poi.cat].label}</i>{poi.name}
          </button>
        </Html>
      )}
    </group>
  );
}

/**
 * 標籤避讓：每隔一小段時間把標籤投影到螢幕上，和優先順序較高的標籤重疊就先藏起來。
 * 拉近鏡頭、標籤分開之後會自動再出現。
 */
function Declutter({ pois }: { pois: Poi[] }) {
  const v = useMemo(() => new THREE.Vector3(), []);
  const acc = useRef(0);
  useFrame(({ camera, size }, dt) => {
    acc.current += dt;
    if (acc.current < 0.2) return;
    acc.current = 0;
    const st = useStore.getState();
    const order = [...pois].sort((a, b) => rank(b, st) - rank(a, st));
    const boxes: [number, number, number, number][] = [];
    const hidden: string[] = [];
    for (const p of order) {
      if (st.filter !== 'all' && st.filter !== p.cat) continue;
      if (p.minor && !st.closeUp && !st.trip.includes(p.id)) continue;
      v.set(p.pos[0], MODELS[p.model].h + 0.4, p.pos[1]).project(camera);
      const x = (v.x * 0.5 + 0.5) * size.width, y = (-v.y * 0.5 + 0.5) * size.height;
      const w = p.name.length * 12.5 + 36 + (st.trip.includes(p.id) ? 22 : 0);
      const b: [number, number, number, number] = [x - w / 2, y - 14, x + w / 2, y + 14];
      if (boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])) hidden.push(p.id);
      else boxes.push(b);
    }
    if (hidden.join() !== st.hidden.join()) st.set({ hidden });
  });
  return null;
}
const rank = (p: Poi, st: ReturnType<typeof useStore.getState>) =>
  (st.selected === p.id ? 100 : 0) + (st.hovered === p.id ? 50 : 0) + (st.trip.includes(p.id) ? 20 : 0) + (p.minor ? 0 : 10) +
  ({ tropic: 9, space: 6, sugar: 8, airport: 7, market: 7, coffee: 6, temple: 6 } as Record<string, number>)[p.model] || 0;

export function Landmarks({ pois, world }: { pois: Poi[]; world: World }) {
  return (
    <>
      {pois.map((p, i) => <Landmark key={p.id} poi={p} index={i} y0={world.groundY(p.pos[0], p.pos[1])} />)}
      <Declutter pois={pois} />
    </>
  );
}
