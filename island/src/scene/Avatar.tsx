// 我的角色：可以換髮型、髮色、膚色、表情、衣著、配件與體型的小人，
// 站在島上或小島上，會擺姿勢、沿著小旅行路線走；還有吉祥物「仙草仔」可以一起合照。
import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import gsap from 'gsap';
import { ISLETS, ISLET_Y, type Avatar as AvatarT } from '../avatar';
import { useStore, frozen } from '../store';
import { ANIM, G, mat } from './kit';
import { MODELS } from './models';
import type { World } from '../world';

/** 角色目前在世界裡的位置（鏡頭跟拍、拍照用） */
export const PLAYER = new THREE.Vector3();

/** 角色可以站的地點：先是小島，再是幾個景點前面。 */
export const PLACE_ORDER = ['lighthouse', 'beach', 'harbor', 'flower', 'star', 'tropic', 'hall', 'market', 'river', 'tunnel', 'butterfly', 'sugar', 'coffee'];

export function placeInfo(id: string, world?: World): { pos: THREE.Vector3; name: string } | null {
  const it = ISLETS.find((x) => x.id === id);
  if (it) return { pos: new THREE.Vector3(it.pos[0], it.kind === 'rock' ? ISLET_Y - 0.05 : ISLET_Y + 0.1, it.pos[1] + it.r * 0.55), name: it.name };
  const p = useStore.getState().pois.find((x) => x.id === id);
  if (!p) return null;
  const off = MODELS[p.model].r + 0.4;
  const y = world ? world.groundY(p.pos[0], p.pos[1] + off) : 0;
  return { pos: new THREE.Vector3(p.pos[0], y, p.pos[1] + off), name: p.name };
}

const DARK = '#2B2622';

// 角色專用的小形狀
/** 笑眼：上半圈的弧線「∩」 */
const SMILE = new THREE.TorusGeometry(0.5, 0.17, 8, 16, Math.PI);
/** 口罩：貼著臉下半部的一片曲面 */
const MASK = new THREE.SphereGeometry(0.5, 24, 10, Math.PI / 2 - 0.85, 1.7, 1.66, 0.72);
/** 裙子：上窄下寬的圓台 */
const SKIRT = (() => { const g = new THREE.CylinderGeometry(0.3, 0.5, 1, 24); g.translate(0, 0.5, 0); return g; })();
/** 斗笠：淺淺的圓錐 */
const KASA = (() => { const g = new THREE.ConeGeometry(0.5, 1, 28); g.translate(0, 0.5, 0); return g; })();
type Ref = React.MutableRefObject<THREE.Group | null>;

function Hair({ a }: { a: AvatarT }) {
  const m = mat(a.hairColor);
  const cap = <mesh geometry={G.dome} material={m} position={[0, 0.03, -0.012]} scale={[0.39, 0.36, 0.39]} rotation={[-0.25, 0, 0]} castShadow />;
  switch (a.hair) {
    case '光頭': return null;
    case '短髮': return <>{cap}<mesh geometry={G.sph} material={m} position={[0, 0.1, 0.12]} scale={[0.3, 0.1, 0.12]} /></>;
    case '長髮': return <>{cap}<mesh geometry={G.box} material={m} position={[0, -0.24, -0.08]} scale={[0.37, 0.36, 0.2]} castShadow /></>;
    case '鮑伯頭': return <>{cap}<mesh geometry={G.sph} material={m} position={[0, -0.04, -0.03]} scale={[0.42, 0.3, 0.38]} /></>;
    case '側分': return <>{cap}<mesh geometry={G.sph} material={m} position={[0.08, 0.12, 0.1]} scale={[0.26, 0.12, 0.16]} rotation={[0, 0, -0.4]} /></>;
    case '捲髮': return <>{Array.from({ length: 11 }, (_, i) => {
      const t = (i / 11) * Math.PI * 2;
      return <mesh key={i} geometry={G.sph} material={m} position={[Math.cos(t) * 0.15, 0.1 + Math.sin(t * 2) * 0.03, Math.sin(t) * 0.13 - 0.03]} scale={0.14} />;
    })}<mesh geometry={G.sph} material={m} position={[0, 0.17, -0.02]} scale={0.22} /></>;
    case '丸子頭': return <>{cap}<mesh geometry={G.sph} material={m} position={[0, 0.25, -0.04]} scale={0.15} castShadow /></>;
    case '馬尾': return <>{cap}<mesh geometry={G.sph} material={m} position={[0, -0.02, -0.22]} scale={[0.1, 0.26, 0.1]} rotation={[0.5, 0, 0]} castShadow /></>;
    case '刺蝟頭': return <>{cap}{[-0.1, 0, 0.1].map((x, i) => <mesh key={i} geometry={G.cone} material={m} position={[x, 0.13, 0.02]} scale={[0.08, 0.13, 0.08]} rotation={[0.3, 0, -x * 2]} />)}</>;
    default: return cap;
  }
}

function Hat({ a }: { a: AvatarT }) {
  switch (a.hat) {
    case '斗笠': return <>
      {/* 戴在頭頂的竹編斗笠：淺圓錐＋一圈帽緣＋下巴繫帶 */}
      <mesh geometry={KASA} material={mat('#E8C987')} position={[0, 0.02, 0]} scale={[0.62, 0.17, 0.62]} castShadow />
      <mesh geometry={G.cyl} material={mat('#C9A35E')} position={[0, 0.015, 0]} scale={[0.63, 0.012, 0.63]} />
      <mesh geometry={G.cyl} material={mat('#C9A35E')} position={[0, 0.09, 0]} scale={[0.3, 0.01, 0.3]} />
      {[-1, 1].map((x) => <mesh key={x} geometry={G.box} material={mat('#9C7452')} position={[x * 0.16, -0.11, 0.04]} rotation={[0, 0, x * 0.15]} scale={[0.008, 0.22, 0.008]} />)}
    </>;
    case '棒球帽': return <><mesh geometry={G.dome} material={mat('#E5574A')} position={[0, 0.06, 0]} scale={[0.38, 0.3, 0.38]} castShadow /><mesh geometry={G.box} material={mat('#E5574A')} position={[0, 0.07, 0.2]} scale={[0.24, 0.025, 0.16]} /></>;
    case '草帽': return <><mesh geometry={G.cyl} material={mat('#EED79A')} position={[0, 0.09, 0]} scale={[0.6, 0.02, 0.6]} castShadow /><mesh geometry={G.dome} material={mat('#EED79A')} position={[0, 0.09, 0]} scale={[0.34, 0.24, 0.34]} /><mesh geometry={G.cyl} material={mat('#F07E6E')} position={[0, 0.1, 0]} scale={[0.35, 0.03, 0.35]} /></>;
    case '毛帽': return <><mesh geometry={G.dome} material={mat('#6FBF8E')} position={[0, 0.05, 0]} scale={[0.4, 0.34, 0.4]} castShadow /><mesh geometry={G.sph} material={mat('#FFFFFF')} position={[0, 0.24, 0]} scale={0.09} /></>;
    case '安全帽': return <><mesh geometry={G.dome} material={mat('#F07E6E')} position={[0, 0.04, 0]} scale={[0.41, 0.33, 0.41]} castShadow /><mesh geometry={G.box} material={mat('#FFFFFF')} position={[0, 0.17, 0]} scale={[0.05, 0.02, 0.34]} /></>;
    default: return null;
  }
}

function Face({ a }: { a: AvatarT }) {
  const z = 0.175;
  const eyes = (() => {
    switch (a.eyes) {
      case '笑眼': return [-1, 1].map((s) => <mesh key={s} geometry={SMILE} material={mat(DARK)} position={[s * 0.065, -0.012, z - 0.004]} scale={[0.055, 0.05, 0.03]} />);
      case '大眼': return [-1, 1].map((s) => <group key={s}><mesh geometry={G.sph} material={mat(DARK)} position={[s * 0.07, 0, z - 0.005]} scale={[0.06, 0.075, 0.03]} /><mesh geometry={G.sph} material={mat('#FFFFFF')} position={[s * 0.07 + 0.012, 0.018, z + 0.008]} scale={0.02} /></group>);
      case '瞇眼': return [-1, 1].map((s) => <mesh key={s} geometry={G.box} material={mat(DARK)} position={[s * 0.065, 0, z]} scale={[0.06, 0.012, 0.01]} />);
      default: return [-1, 1].map((s) => <mesh key={s} geometry={G.sph} material={mat(DARK)} position={[s * 0.065, 0, z]} scale={[0.035, 0.05, 0.02]} />);
    }
  })();
  const mouth = (() => {
    switch (a.mouth) {
      case '微笑': return <mesh geometry={G.sph} material={mat('#C9524A')} position={[0, -0.08, z - 0.01]} scale={[0.06, 0.025, 0.02]} />;
      case '驚訝': return <mesh geometry={G.sph} material={mat('#8E3B35')} position={[0, -0.085, z - 0.01]} scale={[0.035, 0.045, 0.02]} />;
      case '平靜': return <mesh geometry={G.box} material={mat('#8E3B35')} position={[0, -0.08, z - 0.005]} scale={[0.05, 0.01, 0.01]} />;
      default: return null;
    }
  })();
  const acc = (() => {
    switch (a.face) {
      case '眼鏡': return <>{[-1, 1].map((s) => <mesh key={s} geometry={G.torus} material={mat('#3D3A4E')} position={[s * 0.07, 0, z + 0.01]} scale={[0.055, 0.055, 0.02]} />)}<mesh geometry={G.box} material={mat('#3D3A4E')} position={[0, 0.005, z + 0.012]} scale={[0.05, 0.01, 0.01]} /></>;
      case '墨鏡': return <>{[-1, 1].map((s) => <mesh key={s} geometry={G.box} material={mat('#26252D')} position={[s * 0.07, 0, z + 0.008]} scale={[0.1, 0.065, 0.02]} />)}<mesh geometry={G.box} material={mat('#26252D')} position={[0, 0.02, z + 0.01]} scale={[0.06, 0.012, 0.012]} /></>;
      case '口罩': return <>
        {/* 貼著臉的曲面口罩＋兩條耳繩 */}
        <mesh geometry={MASK} material={mat('#EAF3F8', { side: THREE.DoubleSide })} position={[0, 0.01, 0]} scale={0.375} />
        {[-1, 1].map((x) => <mesh key={x} geometry={G.box} material={mat('#D5E3EC')} position={[x * 0.168, -0.035, 0.05]} rotation={[0, x * 0.6, 0]} scale={[0.006, 0.006, 0.12]} />)}
      </>;
      default: return null;
    }
  })();
  return (
    <group position={[0, -0.01, 0]}>
      {eyes}
      {a.face !== '口罩' && mouth}
      {[-1, 1].map((s) => <mesh key={'c' + s} geometry={G.sph} material={mat('#FF9DA8')} position={[s * 0.115, -0.045, z - 0.02]} scale={[0.04, 0.025, 0.015]} />)}
      {acc}
    </group>
  );
}

function Held({ a }: { a: AvatarT }) {
  switch (a.hold) {
    case '仙草茶': return <><mesh geometry={G.cyl} material={mat('#FFFFFF')} position={[0, -0.04, 0.04]} scale={[0.07, 0.11, 0.07]} /><mesh geometry={G.cyl} material={mat('#3B2C22')} position={[0, 0.0, 0.04]} scale={[0.062, 0.06, 0.062]} /><mesh geometry={G.cyl} material={mat('#F07E6E')} position={[0.01, 0.06, 0.04]} scale={[0.01, 0.08, 0.01]} /></>;
    case '相機': return <><mesh geometry={G.box} material={mat('#3D3A4E')} position={[0, -0.02, 0.05]} scale={[0.12, 0.08, 0.06]} /><mesh geometry={G.cyl} material={mat('#9AA3B5')} position={[0, 0.0, 0.09]} rotation={[Math.PI / 2, 0, 0]} scale={[0.05, 0.04, 0.05]} /></>;
    // 氣球不拿在會揮動的手上（見 Balloon），這裡不畫
    case '氣球': return null;
    case '地圖': return <mesh geometry={G.box} material={mat('#F6E3B4')} position={[0, -0.02, 0.07]} rotation={[-0.4, 0, 0]} scale={[0.16, 0.12, 0.01]} />;
    default: return null;
  }
}

/** 氣球：綁在另一隻手（左手）邊，線一直往上，輕輕飄。 */
function Balloon() {
  const ref = useRef<THREE.Group>(null!);
  useFrame(() => {
    if (frozen()) return;
    const t = ANIM.value;
    ref.current.rotation.z = Math.sin(t * 1.3) * 0.08;
    ref.current.rotation.x = Math.cos(t * 1.1) * 0.06;
  });
  return (
    <group position={[-0.2, 0.2, 0.04]}>
      <group ref={ref}>
        <mesh geometry={G.cyl} material={mat('#FFFFFF')} position={[0, 0, 0]} scale={[0.006, 0.62, 0.006]} />
        <mesh geometry={G.sph} material={mat('#F07E6E')} position={[0, 0.74, 0]} scale={[0.22, 0.26, 0.22]} castShadow />
        <mesh geometry={G.cone} material={mat('#F07E6E')} position={[0, 0.6, 0]} scale={[0.04, 0.03, 0.04]} />
        <mesh geometry={G.sph} material={mat('#FFFFFF')} position={[0.06, 0.8, 0.09]} scale={[0.04, 0.06, 0.02]} />
      </group>
    </group>
  );
}

/** 角色本體（臉朝 +z）。 */
export function AvatarFigure({ a, armL, armR, body, held }: { a: AvatarT; armL: Ref; armR: Ref; body: Ref; held?: Ref }) {
  const H = a.height === '矮' ? 0.88 : a.height === '高' ? 1.12 : 1;
  const B = a.build === '瘦' ? 0.85 : a.build === '圓' ? 1.22 : 1;
  const top = mat(a.topColor), skin = mat(a.skin), bot = mat(a.bottomColor), shoe = mat(a.shoes);
  const sleeve = a.top === '背心' ? skin : top;
  const legTop = a.bottom === '長褲' ? 0.2 : 0.2;
  return (
    <group ref={body}>
      <group scale={[1, H, 1]}>
        {/* 鞋子、腿 */}
        {[-1, 1].map((s) => (
          <group key={s}>
            <mesh geometry={G.sph} material={shoe} position={[s * 0.06, 0.03, 0.02]} scale={[0.085, 0.06, 0.12]} castShadow />
            <mesh geometry={G.cyl} material={a.bottom === '長褲' ? bot : skin} position={[s * 0.06, 0.04, 0]} scale={[0.075, legTop - 0.04, 0.075]} castShadow />
          </group>
        ))}
        {a.bottom === '短褲' && [-1, 1].map((s) => <mesh key={s} geometry={G.cyl} material={bot} position={[s * 0.06, 0.12, 0]} scale={[0.09, 0.09, 0.09]} castShadow />)}
        {a.bottom === '裙子' && <mesh geometry={SKIRT} material={bot} position={[0, 0.11, 0]} scale={[0.36 * B, 0.13, 0.32 * B]} castShadow />}
        {/* 身體 */}
        <mesh geometry={G.sph} material={top} position={[0, 0.31, 0]} scale={[0.27 * B, 0.27, 0.22 * B]} castShadow />
        {a.top === '襯衫' && [-1, 1].map((s) => <mesh key={s} geometry={G.box} material={mat('#FFFFFF')} position={[s * 0.04, 0.43, 0.08]} rotation={[0.4, 0, s * 0.5]} scale={[0.06, 0.02, 0.05]} />)}
        {a.top === '連帽外套' && <><mesh geometry={G.sph} material={top} position={[0, 0.45, -0.1]} scale={[0.22, 0.12, 0.14]} /><mesh geometry={G.box} material={mat('#FFFFFF')} position={[0, 0.3, 0.108 * B]} scale={[0.012, 0.2, 0.01]} /></>}
        {a.hold === '氣球' && <Balloon />}
        {a.bag === '背包' && <mesh geometry={G.box} material={mat('#E39B7B')} position={[0, 0.2, -0.14 * B]} scale={[0.2, 0.22, 0.1]} castShadow />}
        {a.bag === '斜背包' && <><mesh geometry={G.box} material={mat('#3D3A4E')} position={[0, 0.31, 0.105 * B]} rotation={[0, 0, 0.8]} scale={[0.32, 0.02, 0.01]} /><mesh geometry={G.box} material={mat('#C08E5D')} position={[-0.13 * B, 0.17, 0.05]} scale={[0.1, 0.09, 0.06]} /></>}
        {/* 手臂（可以擺姿勢） */}
        <group ref={armL} position={[-0.15 * B, 0.39, 0]}>
          <mesh geometry={G.sph} material={sleeve} position={[0, -0.08, 0]} scale={[0.07, 0.17, 0.07]} castShadow />
          <mesh geometry={G.sph} material={skin} position={[0, -0.17, 0]} scale={0.055} />
          {a.bag === '竹籃' && <mesh geometry={G.cyl} material={mat('#C9A06A')} position={[0, -0.27, 0.03]} scale={[0.14, 0.09, 0.12]} />}
        </group>
        <group ref={armR} position={[0.15 * B, 0.39, 0]}>
          <mesh geometry={G.sph} material={sleeve} position={[0, -0.08, 0]} scale={[0.07, 0.17, 0.07]} castShadow />
          <mesh geometry={G.sph} material={skin} position={[0, -0.17, 0]} scale={0.055} />
          {/* 手上的東西：跟著手移動，但永遠保持正立（見 Player 的姿勢計算） */}
          <group ref={held} position={[0, -0.19, 0]} rotation-order="ZYX"><Held a={a} /></group>
        </group>
      </group>
      {/* 大頭 */}
      <group position={[0, 0.44 * H + 0.18, 0]}>
        <mesh geometry={G.sph} material={skin} scale={0.36} castShadow />
        <Face a={a} />
        <Hair a={a} />
        <group position={[0, 0.1, 0]}><Hat a={a} /></group>
      </group>
    </group>
  );
}

/** 吉祥物「仙草仔」：一塊會跳的仙草凍，頭上長了一片葉子。 */
function Mascot() {
  const ref = useRef<THREE.Group>(null!);
  useFrame(() => {
    if (frozen()) return;
    const t = ANIM.value * 4;
    const h = Math.abs(Math.sin(t));
    ref.current.position.y = h * 0.14;
    const sq = Math.cos(t * 2) * 0.08;
    ref.current.scale.set(1 + sq, 1 - sq, 1 + sq);
  });
  return (
    <group ref={ref}>
      <mesh geometry={G.box} material={mat('#3A3330')} position={[0, 0, 0]} scale={[0.42, 0.38, 0.42]} castShadow />
      <mesh geometry={G.box} material={mat('#5A4C45')} position={[-0.07, 0.3, 0.12]} scale={[0.1, 0.06, 0.1]} />
      {[-1, 1].map((s) => <group key={s}>
        <mesh geometry={G.sph} material={mat('#FFFFFF')} position={[s * 0.09, 0.22, 0.21]} scale={[0.09, 0.1, 0.03]} />
        <mesh geometry={G.sph} material={mat(DARK)} position={[s * 0.09, 0.21, 0.225]} scale={[0.045, 0.055, 0.02]} />
        <mesh geometry={G.sph} material={mat('#FF9DA8')} position={[s * 0.16, 0.13, 0.215]} scale={[0.05, 0.025, 0.015]} />
      </group>)}
      <mesh geometry={G.sph} material={mat('#C9524A')} position={[0, 0.13, 0.215]} scale={[0.06, 0.03, 0.02]} />
      <mesh geometry={G.cyl} material={mat('#5FB052')} position={[0, 0.38, 0]} scale={[0.02, 0.1, 0.02]} />
      <mesh geometry={G.sph} material={mat('#6FC05A')} position={[0.07, 0.49, 0]} scale={[0.16, 0.05, 0.08]} rotation={[0, 0, 0.5]} castShadow />
      <Html position={[0, 0.85, 0]} center className="isl-label-wrap"><span className="isl-me-tag is-mascot">仙草仔</span></Html>
    </group>
  );
}

/** 島上的「我」：站在選定的地點、擺姿勢、跟著小旅行走。 */
export function Player({ world }: { world: World }) {
  const a = useStore((s) => s.avatar);
  const place = useStore((s) => s.place);
  const mascot = useStore((s) => s.mascot);
  const panelOpen = useStore((s) => s.panel === 'character' && s.sidebar);
  const root = useRef<THREE.Group>(null!);
  const turn = useRef<THREE.Group>(null!);
  const body = useRef<THREE.Group | null>(null), armL = useRef<THREE.Group | null>(null), armR = useRef<THREE.Group | null>(null);
  const held = useRef<THREE.Group | null>(null);
  const ring = useRef<THREE.Mesh>(null!);
  const target = useMemo(() => placeInfo(place, world), [place, world]);
  const walk = useRef({ seg: 0, s: 0, wait: 0, path: [] as THREE.Vector3[], names: [] as string[] });

  const cheer = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return;
    e.stopPropagation();
    if (!body.current) return;
    gsap.timeline().to(body.current.position, { y: 0.35, duration: 0.2, ease: 'power2.out' })
      .to(body.current.rotation, { y: '+=' + Math.PI * 2, duration: 0.45 }, 0)
      .to(body.current.position, { y: 0, duration: 0.4, ease: 'bounce.out' }, 0.2);
    const s = useStore.getState();
    s.say(`${s.avatar.name || '我'}（${s.avatar.role}）跟你打招呼！`);
  };

  useFrame(({ camera }, dt) => {
    const st = useStore.getState();
    const g = root.current;
    const t = ANIM.value;
    const still = frozen();
    let moving = false;
    let heading: number | null = null;

    // ── 沿著小旅行走 ──
    const w = walk.current;
    if (st.walking) {
      if (!w.path.length) {
        const pts = st.trip.map((id) => placeInfo(id, world)).filter(Boolean) as { pos: THREE.Vector3; name: string }[];
        if (pts.length < 1) { st.set({ walking: false }); }
        else {
          w.path = [g.position.clone(), ...pts.map((p) => p.pos)];
          w.names = ['', ...pts.map((p) => p.name)];
          w.seg = 0; w.s = 0; w.wait = 0;
        }
      }
      if (w.path.length > 1 && !still) {
        if (w.wait > 0) w.wait -= dt;
        else {
          const a0 = w.path[w.seg], b0 = w.path[w.seg + 1];
          const len = a0.distanceTo(b0) || 0.001;
          w.s += Math.min(dt, 0.1) * 1.6;
          const k = Math.min(1, w.s / len);
          g.position.lerpVectors(a0, b0, k);
          g.position.y = world.groundY(g.position.x, g.position.z);
          heading = Math.atan2(b0.x - a0.x, b0.z - a0.z);
          moving = true;
          if (k >= 1) {
            st.say(`抵達第 ${w.seg + 1} 站：${w.names[w.seg + 1]}`);
            w.seg++; w.s = 0; w.wait = 1.4;
            if (w.seg >= w.path.length - 1) {
              const last = st.trip[st.trip.length - 1];
              st.set({ walking: false, place: last });
              w.path = [];
            }
          }
        }
      }
    } else {
      if (w.path.length) w.path = [];
      if (target) {
        // 換地點：跳過去（距離遠時直接瞬移，近的話滑過去）
        if (g.position.distanceTo(target.pos) > 6) g.position.copy(target.pos);
        else g.position.lerp(target.pos, Math.min(1, dt * 4));
      }
    }
    PLAYER.copy(g.position);

    // ── 朝向：走路時看前方；站著時面向鏡頭（或背面） ──
    if (heading === null) {
      const face = Math.atan2(camera.position.x - g.position.x, camera.position.z - g.position.z);
      heading = st.facing === 'back' ? face + Math.PI : face;
    }
    const cur = turn.current.rotation.y;
    let d = heading - cur;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    turn.current.rotation.y = cur + d * Math.min(1, dt * 8);

    // ── 姿勢 ──
    const L = armL.current, R = armR.current, B = body.current;
    if (!L || !R || !B || still) return;
    let lz = -0.12, rz = 0.12, rx = 0, lx = 0, by = 0, spin = 0;
    if (moving) {
      const ph = t * 12;
      by = Math.abs(Math.sin(ph)) * 0.06;
      lx = Math.sin(ph) * 0.6; rx = -Math.sin(ph) * 0.6;
    } else {
      switch (st.pose) {
        case '揮手': rz = 2.6 + Math.sin(t * 8) * 0.35; break;
        case '比 YA': rz = 0.5; rx = -2.0; break;
        case '跳起來': by = Math.abs(Math.sin(t * 4)) * 0.3; lz = -2.6; rz = 2.6; break;
        case '轉圈': spin = t * 3; lz = -1.2; rz = 1.2; break;
        default: by = Math.sin(t * 2) * 0.008;
      }
    }
    L.rotation.set(lx, 0, lz); R.rotation.set(rx, 0, rz);
    // 抵銷手臂的旋轉，手上的仙草茶、相機、地圖才不會跟著倒過來
    held.current?.rotation.set(-rx, 0, -rz);
    B.position.y = by;
    B.rotation.y = spin;
    // 腳下的圈圈：面板開著時亮橘色，平常淡淡的
    const m = ring.current.material as THREE.MeshBasicMaterial;
    m.opacity = THREE.MathUtils.damp(m.opacity, panelOpen ? 0.9 : 0.45, 6, dt);
    ring.current.scale.setScalar(0.62 + Math.sin(t * 3) * 0.03);
  });

  return (
    <group ref={root}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[0.7, 1, 40]} />
        <meshBasicMaterial color="#E56A3A" transparent opacity={0.6} depthWrite={false} />
      </mesh>
      <group ref={turn} onClick={cheer}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { document.body.style.cursor = ''; }}>
        <AvatarFigure a={a} armL={armL} armR={armR} body={body} held={held} />
        <mesh visible={false} position={[0, 0.5, 0]} scale={[0.6, 1.1, 0.6]}><boxGeometry /></mesh>
        {mascot && <group position={[0.52, 0, 0.05]}><Mascot /></group>}
      </group>
      <Html position={[0, 1.38, 0]} center className="isl-label-wrap" zIndexRange={[35, 30]}>
        <button type="button" className="isl-me-tag" onClick={() => {
          const s = useStore.getState();
          s.set({ sidebar: true, panel: 'character', meTick: s.meTick + 1 });
        }}><b>我</b>{a.name ? `${a.name}・` : ''}<span>{a.role}</span></button>
      </Html>
    </group>
  );
}
