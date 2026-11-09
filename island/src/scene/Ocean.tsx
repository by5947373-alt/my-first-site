// 海洋與附近的小島：會流動的海面、沿岸白浪、六座小島、帆船和海鷗。
// （裝飾用的想像場景：水上鄉本身不靠海。）
import { useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { LAND, curveOf, ribbon } from '../geo';
import { ISLETS, ISLET_Y, SEA_Y, type Islet } from '../avatar';
import { useStore, frozen } from '../store';
import { ANIM, Box, C, Cone, Cyl, Dome, G, House, NIGHT, Sph, mat, texMat, windMat } from './kit';

/** 海面貼圖：淡淡的波紋線條。 */
function seaTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#58BFD3'; g.fillRect(0, 0, 256, 256);
  let seed = 3;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 46; i++) {
    const x = r() * 256, y = r() * 256, w = 10 + r() * 22;
    g.strokeStyle = `rgba(255,255,255,${0.18 + r() * 0.25})`;
    g.lineWidth = 2.2;
    g.lineCap = 'round';
    for (const ox of [0, -256, 256]) for (const oy of [0, -256, 256]) {
      g.beginPath(); g.moveTo(x + ox, y + oy); g.quadraticCurveTo(x + ox + w / 2, y + oy - 4, x + ox + w, y + oy); g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(9, 9);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** 海面邊緣淡出，和天空背景自然融在一起。 */
function fadeTexture() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const g = cv.getContext('2d')!;
  const gr = g.createRadialGradient(128, 128, 70, 128, 128, 128);
  gr.addColorStop(0, '#fff'); gr.addColorStop(1, '#000');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(cv);
}

function Sea() {
  const { m, tex } = useMemo(() => {
    const tex = seaTexture();
    const m = texMat(tex);
    m.alphaMap = fadeTexture();
    m.transparent = true;
    m.depthWrite = false;
    return { m, tex };
  }, []);
  useFrame((_, dt) => { if (!frozen()) { tex.offset.x += dt * 0.012; tex.offset.y += dt * 0.006; } });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, SEA_Y, 1]} material={m} receiveShadow renderOrder={-1}>
      <circleGeometry args={[46, 64]} />
    </mesh>
  );
}

/** 沿著海岸一圈白浪，一呼一吸地拍打。 */
function Foam() {
  const geo = useMemo(() => {
    // 島的輪廓稍微往外推一點，白浪才會貼在崖壁外側
    const cx = 0, cz = 0;
    const pts = LAND.map(([x, z]) => {
      const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz) || 1;
      return [x + (dx / d) * 0.18, z + (dz / d) * 0.18] as [number, number];
    });
    const curve = curveOf([...pts, pts[0]], 0, true, 0.3);
    return ribbon(curve, 0.55, SEA_Y + 0.03, 0.3);
  }, []);
  const m = useMemo(() => new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.7, depthWrite: false }), []);
  useFrame(() => { m.opacity = 0.45 + Math.sin(ANIM.value * 1.6) * 0.2; });
  return <mesh geometry={geo} material={m} />;
}

// ─────────────────────────── 小島 ───────────────────────────
function IsletBase({ r }: { r: number }) {
  const top = ISLET_Y;
  return (
    <group>
      <mesh geometry={G.cyl} material={mat(C.soil)} position={[0, SEA_Y - 0.6, 0]} scale={[r * 2, top - SEA_Y + 0.52, r * 2]} castShadow receiveShadow />
      {/* 沙灘邊 */}
      <mesh geometry={G.cyl} material={mat('#F6E3B4')} position={[0, SEA_Y - 0.02, 0]} scale={[r * 2.25, 0.2, r * 2.25]} receiveShadow />
      <mesh geometry={G.dome} material={mat(C.grass)} position={[0, top - 0.1, 0]} scale={[r * 1.9, 0.4, r * 1.9]} receiveShadow />
      {/* 白浪圈 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, SEA_Y + 0.03, 0]} scale={r * 2.5}>
        <ringGeometry args={[0.44, 0.5, 40]} />
        <meshBasicMaterial color="#FFFFFF" transparent opacity={0.6} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Palm({ p, s = 1 }: { p: [number, number, number]; s?: number }) {
  return (
    <group position={p} scale={s}>
      <mesh geometry={G.cyl6} material={mat(C.trunk)} scale={[0.07, 0.9, 0.07]} rotation={[0, 0, 0.12]} castShadow />
      {[0, 1.25, 2.5, 3.75, 5].map((a) => (
        <mesh key={a} geometry={G.sph} material={windMat(C.leaf, 0.05)} position={[0.1 + Math.cos(a) * 0.2, 0.9, Math.sin(a) * 0.2]} scale={[0.42, 0.08, 0.16]} rotation={[0, -a, -0.35]} castShadow />
      ))}
    </group>
  );
}

function Lighthouse() {
  const beam = useRef<THREE.Group>(null!);
  const beamMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#FFE9A8', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }), []);
  useFrame(() => {
    beam.current.rotation.y = ANIM.value * 0.8;
    beamMat.opacity = Math.max(0, NIGHT.value - 0.2) * 0.5;
  });
  return (
    <group position={[0.2, ISLET_Y, -0.2]}>
      <Cyl s={[0.7, 0.18, 0.7]} c={C.stone} />
      {[0, 1, 2, 3].map((i) => <Cyl key={i} p={[0, 0.18 + i * 0.32, 0]} s={[0.46 - i * 0.04, 0.32, 0.46 - i * 0.04]} c={i % 2 ? C.red : C.white} />)}
      <Cyl p={[0, 1.46, 0]} s={[0.36, 0.26, 0.36]} c={C.glass} />
      <Cone p={[0, 1.72, 0]} s={[0.46, 0.3, 0.46]} c={C.red} />
      <group ref={beam} position={[0, 1.58, 0]}>
        <mesh material={beamMat} rotation={[0, 0, -Math.PI / 2]} position={[1.6, 0, 0]}>
          <coneGeometry args={[0.45, 3.2, 16, 1, true]} />
        </mesh>
      </group>
      <House p={[-0.75, 0, 0.45]} w={0.45} d={0.38} h={0.3} roof={C.sky} />
    </group>
  );
}

function Harbor() {
  return (
    <group position={[0, ISLET_Y, 0]}>
      <House p={[-0.6, 0, -0.4]} w={0.5} d={0.4} h={0.32} roof={C.coral} />
      <House p={[0.3, 0, -0.7]} w={0.45} d={0.38} h={0.28} roof={C.butter} />
      {/* 伸進海裡的木棧道 */}
      <Box p={[0.6, -0.12, 1.4]} s={[0.4, 0.06, 2.2]} c={C.wood} />
      {[0.6, 1.2, 1.8, 2.4].map((z) => [0.42, 0.78].map((x) => <Cyl key={x + '' + z} p={[x, -0.6, z]} s={[0.06, 0.52, 0.06]} c={C.woodDark} shadow={false} />))}
      {[0, 1, 2].map((i) => <Box key={i} p={[-0.2 + i * 0.25, 0, 0.5]} s={[0.18, 0.14, 0.18]} c={[C.sky, C.coral, C.wood][i]} />)}
    </group>
  );
}

function Beach() {
  return (
    <group position={[0, ISLET_Y, 0]}>
      <mesh geometry={G.dome} material={mat('#F6E3B4')} position={[0.6, -0.08, 0.6]} scale={[2.4, 0.3, 2]} receiveShadow />
      <Palm p={[-0.8, 0, -0.6]} s={1.1} />
      <Palm p={[-0.2, 0, -1.1]} s={0.85} />
      {[[0.5, 0.4, C.coral], [1.2, 0.9, C.sky]].map(([x, z, c], i) => (
        <group key={i} position={[x as number, 0, z as number]}>
          <Cyl s={[0.03, 0.5, 0.03]} c={C.white} shadow={false} />
          <Cone p={[0, 0.42, 0]} s={[0.7, 0.2, 0.7]} c={c as string} />
          <Box p={[0.25, 0, 0.1]} s={[0.4, 0.04, 0.2]} c={C.white} />
        </group>
      ))}
    </group>
  );
}

function FlowerIsle() {
  const blades = useRef<THREE.Group>(null!);
  useFrame(() => { blades.current.rotation.z = -ANIM.value * 1.4; });
  return (
    <group position={[0, ISLET_Y, 0]}>
      {Array.from({ length: 30 }, (_, i) => {
        const a = i * 2.39, r = 0.3 + (i % 6) * 0.2;
        return <Sph key={i} p={[Math.cos(a) * r, 0.05, Math.sin(a) * r]} s={0.13} c={['#FF9DB8', '#FFD84D', '#B99CF2', '#FFFFFF', '#FF8A65'][i % 5]} />;
      })}
      {/* 風車 */}
      <group position={[0.3, 0, -0.6]}>
        <Cyl s={[0.4, 0.9, 0.4]} c={C.wall} />
        <Cone p={[0, 0.9, 0]} s={[0.5, 0.35, 0.5]} c={C.coral} />
        <group ref={blades} position={[0, 0.85, 0.24]}>
          {[0, 1, 2, 3].map((i) => <Box key={i} p={[0, 0, 0]} s={[0.1, 0.7, 0.03]} r={[0, 0, (i * Math.PI) / 2]} c={C.wood} />)}
        </group>
      </group>
    </group>
  );
}

function StarIsle() {
  return (
    <group position={[0, ISLET_Y, 0]}>
      <Cyl p={[0, 0, 0]} s={[0.7, 0.3, 0.7]} c={C.wall} />
      <Dome p={[0, 0.3, 0]} s={[0.66, 0.5, 0.66]} c="#DCE6F2" />
      <Box p={[0.15, 0.42, 0.1]} s={[0.06, 0.08, 0.3]} c={C.dark} r={[0.6, 0.4, 0]} />
      <Box p={[0.6, 0, 0.55]} s={[0.4, 0.06, 0.14]} c={C.wood} />
    </group>
  );
}

function Rock() {
  return (
    <group position={[0, SEA_Y, 0]}>
      <Sph p={[0, 0.1, 0]} s={[1.3, 0.9, 1.1]} c="#A9A49A" />
      <Sph p={[0.5, 0.05, 0.3]} s={[0.7, 0.5, 0.6]} c="#BDB8AE" />
      <Sph p={[0.05, 0.52, 0]} s={[0.14, 0.1, 0.2]} c={C.white} />
    </group>
  );
}

function IsletView({ it }: { it: Islet }) {
  const click = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return;
    e.stopPropagation();
    const s = useStore.getState();
    s.say(`${it.name}：${it.text}`);
    // 角色面板開著時，點小島就讓角色過去站
    if (s.panel === 'character' && s.sidebar) s.set({ place: it.id, meTick: s.meTick + 1 });
  };
  return (
    <group position={[it.pos[0], 0, it.pos[1]]} onClick={click}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = ''; }}>
      {it.kind !== 'rock' && <IsletBase r={it.r} />}
      {it.kind === 'lighthouse' && <Lighthouse />}
      {it.kind === 'harbor' && <Harbor />}
      {it.kind === 'beach' && <Beach />}
      {it.kind === 'flower' && <FlowerIsle />}
      {it.kind === 'star' && <StarIsle />}
      {it.kind === 'rock' && <Rock />}
    </group>
  );
}

// ─────────────────────────── 帆船、海鷗 ───────────────────────────
function Sailboat({ rx, rz, speed, phase, color }: { rx: number; rz: number; speed: number; phase: number; color: string }) {
  const ref = useRef<THREE.Group>(null!);
  useFrame(() => {
    const t = ANIM.value * speed + phase;
    const x = Math.cos(t) * rx, z = Math.sin(t) * rz + 1;
    ref.current.position.set(x, SEA_Y + 0.02 + Math.sin(t * 9) * 0.04, z);
    ref.current.rotation.set(Math.sin(t * 7) * 0.06, Math.atan2(-Math.cos(t) * rz, -Math.sin(t) * rx), 0);
  });
  return (
    <group ref={ref}>
      <Box p={[0, 0, 0]} s={[0.9, 0.2, 0.34]} c={C.white} />
      <Box p={[0, 0.14, 0]} s={[0.7, 0.04, 0.28]} c={C.wood} />
      <Cyl p={[0, 0.16, 0]} s={[0.04, 1.0, 0.04]} c={C.woodDark} shadow={false} />
      <mesh position={[-0.2, 0.62, 0]} rotation={[0, 0, 0]} material={mat(color, { side: THREE.DoubleSide })} castShadow>
        <shapeGeometry args={[(() => { const s = new THREE.Shape(); s.moveTo(0.18, -0.4); s.lineTo(0.18, 0.5); s.lineTo(-0.35, -0.4); s.closePath(); return s; })()]} />
      </mesh>
    </group>
  );
}

function Gull({ r, h, speed, phase }: { r: number; h: number; speed: number; phase: number }) {
  const ref = useRef<THREE.Group>(null!);
  const l = useRef<THREE.Group>(null!), rr = useRef<THREE.Group>(null!);
  useFrame(() => {
    const t = ANIM.value * speed + phase;
    ref.current.position.set(-11 + Math.cos(t) * r, h + Math.sin(t * 2) * 0.3, -15 + Math.sin(t) * r);
    ref.current.rotation.y = -t;
    const f = Math.sin(ANIM.value * 8 + phase) * 0.5;
    l.current.rotation.x = f; rr.current.rotation.x = -f;
  });
  return (
    <group ref={ref}>
      <Sph s={[0.12, 0.1, 0.22]} c={C.white} />
      <group ref={l}><mesh geometry={G.box} material={mat(C.white)} position={[0, 0, 0.16]} scale={[0.1, 0.02, 0.3]} /></group>
      <group ref={rr}><mesh geometry={G.box} material={mat(C.white)} position={[0, 0, -0.16]} scale={[0.1, 0.02, 0.3]} /></group>
    </group>
  );
}

export function Ocean() {
  return (
    <group>
      <Sea />
      <Foam />
      {ISLETS.map((it) => <IsletView key={it.id} it={it} />)}
      <Sailboat rx={28} rz={17} speed={0.025} phase={0} color={C.coral} />
      <Sailboat rx={31} rz={19} speed={-0.018} phase={2} color={C.butter} />
      <Sailboat rx={26} rz={20} speed={0.02} phase={4} color={C.sky} />
      <Gull r={2.2} h={1.2} speed={0.5} phase={0} />
      <Gull r={2.8} h={1.6} speed={0.42} phase={2} />
      <Gull r={1.8} h={1.0} speed={0.55} phase={4} />
    </group>
  );
}
