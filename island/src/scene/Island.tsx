// 島嶼本體：水上鄉行政區輪廓擠出的厚底座、農田、道路、河流、鐵道與北回歸線。
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TROPIC_Z, landSpansAtZ, ribbon, curveOf, toWorld, type V2 } from '../geo';
import { landShape, type World } from '../world';
import { C, G, mat, windMat } from './kit';
import { useStore, frozen } from '../store';

const dummy = new THREE.Object3D();
const color = new THREE.Color();

function Base() {
  const geos = useMemo(() => {
    const shape = landShape();
    const top = new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.12, bevelSegments: 1, curveSegments: 1 });
    const soil = new THREE.ExtrudeGeometry(shape, { depth: 1.25, bevelEnabled: false, curveSegments: 1 });
    const bottom = new THREE.ExtrudeGeometry(shape, { depth: 0.45, bevelEnabled: true, bevelThickness: 0.05, bevelSize: -0.05, bevelSegments: 1, curveSegments: 1 });
    return { top, soil, bottom };
  }, []);
  const rot: [number, number, number] = [-Math.PI / 2, 0, 0];
  return (
    <group>
      {/* 草皮層 */}
      <mesh geometry={geos.top} rotation={rot} position={[0, -0.4, 0]} material={[mat(C.grass), mat(C.grassSide)]} receiveShadow />
      {/* 土壤層（底座的厚度） */}
      <mesh geometry={geos.soil} rotation={rot} position={[0, -1.6, 0]} material={[mat(C.soilDark), mat(C.soil)]} castShadow />
      <mesh geometry={geos.bottom} rotation={rot} position={[0, -2.05, 0]} material={[mat(C.base), mat(C.soilDark)]} />
    </group>
  );
}

function Hills({ world }: { world: World }) {
  const ref = useRef<THREE.InstancedMesh>(null!);
  useLayoutEffect(() => {
    world.hills.forEach((h, i) => {
      dummy.position.set(h.x, -0.02, h.z);
      dummy.scale.set(h.r * 2, h.h * 2, h.r * 2 * 0.9);
      dummy.rotation.set(0, h.tone * 3, 0);
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
      ref.current.setColorAt(i, color.set(h.tone < 0.5 ? '#9CC67E' : '#A9CF88'));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [world]);
  return <instancedMesh ref={ref} args={[G.sph, mat('#ffffff'), world.hills.length]} receiveShadow castShadow />;
}

function Fields({ world }: { world: World }) {
  const plots = useRef<THREE.InstancedMesh>(null!);
  const tufts = useRef<THREE.InstancedMesh>(null!);
  // 每塊作物田上排幾列小作物，微風吹過時一起搖
  const tuftList = useMemo(() => {
    const out: { x: number; z: number; s: number; c: string }[] = [];
    for (const f of world.fields) {
      if (f.kind === 'pond' || f.kind === 'plain') continue;
      const cols = f.kind === 'herb' ? 4 : 3, rows = 3;
      const c = f.kind === 'rice' ? '#D8BE5E' : f.kind === 'herb' ? '#5E9257' : '#8DBE6C';
      const cs = Math.cos(f.r), sn = Math.sin(f.r);
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        const u = ((i + 0.5) / cols - 0.5) * f.w * 0.8, v = ((j + 0.5) / rows - 0.5) * f.d * 0.8;
        out.push({ x: f.x + u * cs + v * sn, z: f.z - u * sn + v * cs, s: f.kind === 'rice' ? 0.16 : 0.13, c });
      }
    }
    return out;
  }, [world]);

  useLayoutEffect(() => {
    world.fields.forEach((f, i) => {
      dummy.position.set(f.x, f.kind === 'pond' ? -0.01 : 0, f.z);
      dummy.rotation.set(0, f.r, 0);
      dummy.scale.set(f.w, f.kind === 'pond' ? 0.04 : 0.06, f.d);
      dummy.updateMatrix();
      plots.current.setMatrixAt(i, dummy.matrix);
      plots.current.setColorAt(i, color.set(f.color));
    });
    plots.current.instanceMatrix.needsUpdate = true;
    if (plots.current.instanceColor) plots.current.instanceColor.needsUpdate = true;
    tuftList.forEach((t, i) => {
      dummy.position.set(t.x, 0.05, t.z);
      dummy.rotation.set(0, i, 0);
      dummy.scale.set(t.s, t.s * 1.5, t.s);
      dummy.updateMatrix();
      tufts.current.setMatrixAt(i, dummy.matrix);
      tufts.current.setColorAt(i, color.set(t.c));
    });
    tufts.current.instanceMatrix.needsUpdate = true;
    if (tufts.current.instanceColor) tufts.current.instanceColor.needsUpdate = true;
  }, [world, tuftList]);

  return (
    <>
      <instancedMesh ref={plots} args={[G.box, mat('#ffffff'), world.fields.length]} receiveShadow />
      <instancedMesh ref={tufts} args={[G.cone, windMat('#ffffff', 0.05, 2.2), tuftList.length]} castShadow />
    </>
  );
}

function Roads({ world }: { world: World }) {
  const geo = useMemo(() => {
    const top = world.roads.map((r) => ribbon(r.curve, r.main ? 0.34 : 0.24, 0.025));
    const curb = world.roads.map((r) => ribbon(r.curve, (r.main ? 0.34 : 0.24) + 0.08, 0.018));
    return { top: mergeGeometries(top), curb: mergeGeometries(curb) };
  }, [world]);
  return (
    <>
      <mesh geometry={geo.curb} material={mat(C.curb)} receiveShadow />
      <mesh geometry={geo.top} material={mat(C.road)} receiveShadow />
    </>
  );
}

function waterTexture() {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 64;
  const g = cv.getContext('2d')!;
  g.fillStyle = C.water; g.fillRect(0, 0, 256, 64);
  for (let i = 0; i < 26; i++) {
    g.strokeStyle = `rgba(255,255,255,${0.25 + Math.random() * 0.35})`;
    g.lineWidth = 2 + Math.random() * 2;
    const x = Math.random() * 256, y = 6 + Math.random() * 52, l = 18 + Math.random() * 40;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + l, y); g.stroke();
    g.beginPath(); g.moveTo(x - 256, y); g.lineTo(x - 256 + l, y); g.stroke();
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(0.45, 1);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function Rivers({ world }: { world: World }) {
  const { water, bank, tex } = useMemo(() => {
    const tex = waterTexture();
    return {
      tex,
      water: mergeGeometries(world.rivers.map((r) => ribbon(r.curve, r.main ? 0.62 : 0.26, 0.03, 0.2))),
      bank: mergeGeometries(world.rivers.map((r) => ribbon(r.curve, (r.main ? 0.62 : 0.26) + 0.22, 0.012, 0.2))),
    };
  }, [world]);
  const m = useMemo(() => new THREE.MeshLambertMaterial({ map: tex }), [tex]);
  useFrame((_, dt) => { if (!frozen()) tex.offset.x -= dt * 0.18; });
  return (
    <>
      <mesh geometry={bank} material={mat(C.bank)} receiveShadow />
      <mesh geometry={water} material={m} receiveShadow />
    </>
  );
}

function Rail({ world }: { world: World }) {
  const curve = world.rail;
  const data = useMemo(() => {
    if (!curve) return null;
    const pts = curve.getSpacedPoints(Math.ceil(curve.getLength() / 0.2));
    const off = (k: number) => curveOf(pts.map((p, i) => {
      const t = curve.getTangentAt(i / (pts.length - 1));
      return [p.x - t.z * k, p.z + t.x * k] as V2;
    }), 0);
    return {
      bed: ribbon(curve, 0.3, 0.02),
      rails: mergeGeometries([ribbon(off(0.065), 0.025, 0.06), ribbon(off(-0.065), 0.025, 0.06)]),
      sleepers: pts.map((p, i) => ({ p, a: Math.atan2(-curve.getTangentAt(i / (pts.length - 1)).z, curve.getTangentAt(i / (pts.length - 1)).x) })),
    };
  }, [curve]);
  const sl = useRef<THREE.InstancedMesh>(null!);
  useLayoutEffect(() => {
    if (!data) return;
    data.sleepers.forEach(({ p, a }, i) => {
      dummy.position.set(p.x, 0.03, p.z);
      dummy.rotation.set(0, a, 0);
      dummy.scale.set(0.05, 0.03, 0.22);
      dummy.updateMatrix();
      sl.current.setMatrixAt(i, dummy.matrix);
    });
    sl.current.instanceMatrix.needsUpdate = true;
  }, [data]);
  if (!data) return null;
  return (
    <>
      <mesh geometry={data.bed} material={mat(C.gravel)} receiveShadow />
      <instancedMesh ref={sl} args={[G.box, mat(C.woodDark), data.sleepers.length]} />
      <mesh geometry={data.rails} material={mat(C.rail)} />
    </>
  );
}

/** 北回歸線：島上一條會呼吸的金色光帶。 */
function Tropic() {
  const spans = useMemo(() => landSpansAtZ(TROPIC_Z), []);
  const m = useMemo(() => new THREE.MeshBasicMaterial({ color: '#F6C453', transparent: true, opacity: 0.85, depthWrite: false }), []);
  useFrame(({ clock }) => {
    const pulse = useStore.getState().selected === 'tropic' ? 1 : 0;
    m.opacity = 0.55 + 0.3 * Math.sin(clock.elapsedTime * (2 + pulse * 3)) * 0.5 + 0.15 + pulse * 0.2;
  });
  const geo = useMemo(() => mergeGeometries(spans.map(([a, b]) => {
    const g = new THREE.PlaneGeometry(b - a - 0.2, 0.12);
    g.rotateX(-Math.PI / 2);
    g.translate((a + b) / 2, 0.075, TROPIC_Z);
    return g;
  })), [spans]);
  if (!spans.length) return null;
  // 標籤放在品皇咖啡與機場之間，避開景點名稱
  const tagX = Math.max(spans[0][0] + 0.5, toWorld([250, 0])[0]);
  return (
    <>
      <mesh geometry={geo} material={m} />
      <Html position={[tagX, 0.1, TROPIC_Z]} center className="isl-tropic-tag" zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
        北回歸線 23.5°N
      </Html>
    </>
  );
}

export function Island({ world }: { world: World }) {
  return (
    <group>
      <Base />
      <Hills world={world} />
      <Fields world={world} />
      <Rivers world={world} />
      <Roads world={world} />
      <Rail world={world} />
      <Tropic />
    </group>
  );
}
