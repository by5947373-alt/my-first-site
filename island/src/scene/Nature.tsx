// 樹木（微風搖擺）、聚落房屋、雲朵。全部用 InstancedMesh，一種形狀一次 draw call。
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { World } from '../world';
import { BOUNDS } from '../geo';
import { C, G, NIGHT, ROOFS, addGrow, mat, windMat } from './kit';
import { frozen } from '../store';

const dummy = new THREE.Object3D();
const color = new THREE.Color();
const LEAVES = [C.leaf, C.leaf2, C.leaf3, '#7CCB5E', '#9AD474'];

export function Trees({ world }: { world: World }) {
  const trunk = useRef<THREE.InstancedMesh>(null!);
  const round = useRef<THREE.InstancedMesh>(null!);
  const pine = useRef<THREE.InstancedMesh>(null!);
  const palm = useRef<THREE.InstancedMesh>(null!);
  const groups = useMemo(() => ({
    round: world.trees.filter((t) => t.kind === 0),
    pine: world.trees.filter((t) => t.kind === 1),
    palm: world.trees.filter((t) => t.kind === 2),
  }), [world]);

  useLayoutEffect(() => {
    world.trees.forEach((t, i) => {
      const y = world.groundY(t.x, t.z);
      const h = t.kind === 2 ? 0.9 : 0.22;
      dummy.position.set(t.x, y - 0.02, t.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(t.kind === 2 ? 0.035 : 0.06, h * t.s, t.kind === 2 ? 0.035 : 0.06);
      dummy.updateMatrix();
      trunk.current.setMatrixAt(i, dummy.matrix);
    });
    trunk.current.instanceMatrix.needsUpdate = true;

    const fill = (mesh: THREE.InstancedMesh, list: typeof world.trees, f: (t: (typeof list)[number]) => void) => {
      list.forEach((t, i) => {
        f(t);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i, color.set(LEAVES[Math.floor(t.tone * LEAVES.length)]));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    };
    fill(round.current, groups.round, (t) => {
      const y = world.groundY(t.x, t.z);
      dummy.position.set(t.x, y + 0.38 * t.s, t.z);
      dummy.rotation.set(0, t.tone * 6, 0);
      dummy.scale.set(0.46 * t.s, 0.42 * t.s, 0.46 * t.s);
    });
    fill(pine.current, groups.pine, (t) => {
      const y = world.groundY(t.x, t.z);
      dummy.position.set(t.x, y + 0.12 * t.s, t.z);
      dummy.rotation.set(0, t.tone * 6, 0);
      dummy.scale.set(0.34 * t.s, 0.62 * t.s, 0.34 * t.s);
    });
    fill(palm.current, groups.palm, (t) => {
      const y = world.groundY(t.x, t.z);
      dummy.position.set(t.x, y + 0.9 * t.s, t.z);
      dummy.rotation.set(0, t.tone * 6, 0);
      dummy.scale.set(0.3 * t.s, 0.12 * t.s, 0.3 * t.s);
    });
  }, [world, groups]);

  return (
    <>
      <instancedMesh ref={trunk} args={[G.cyl6, mat(C.trunk), world.trees.length]} castShadow />
      <instancedMesh ref={round} args={[G.ico, windMat('#ffffff', 0.05), groups.round.length]} castShadow receiveShadow />
      <instancedMesh ref={pine} args={[G.cone, windMat('#ffffff', 0.04), groups.pine.length]} castShadow receiveShadow />
      <instancedMesh ref={palm} args={[G.ico, windMat('#ffffff', 0.08, 1.1), groups.palm.length]} castShadow />
    </>
  );
}

const WALLS = [C.wall, C.wall2, C.wall3];
export function Houses({ world }: { world: World }) {
  const body = useRef<THREE.InstancedMesh>(null!);
  const roof = useRef<THREE.InstancedMesh>(null!);
  const win = useRef<THREE.InstancedMesh>(null!);
  // 窗戶：白天是淡色玻璃，入夜後一盞盞亮起暖黃色
  const winMat = useMemo(() => { const m = new THREE.MeshBasicMaterial({ color: '#CFE3EA' }); addGrow(m, 'win'); return m; }, []);
  const dayC = useMemo(() => new THREE.Color('#CFE3EA'), []), nightC = useMemo(() => new THREE.Color('#FFCF6E'), []);
  useFrame(() => { winMat.color.copy(dayC).lerp(nightC, NIGHT.value); });
  useLayoutEffect(() => {
    world.houses.forEach((h, i) => {
      dummy.position.set(h.x, 0, h.z);
      dummy.rotation.set(0, h.r, 0);
      dummy.scale.set(h.w, h.h, h.d);
      dummy.updateMatrix();
      body.current.setMatrixAt(i, dummy.matrix);
      body.current.setColorAt(i, color.set(WALLS[h.wall]));
      dummy.position.set(h.x, h.h, h.z);
      // 高樓用平屋頂，矮房子用人字屋頂
      dummy.scale.set(h.w + 0.06, h.h > 0.5 ? 0.06 : 0.2, h.d + 0.06);
      dummy.updateMatrix();
      roof.current.setMatrixAt(i, dummy.matrix);
      roof.current.setColorAt(i, color.set(ROOFS[h.roof]));
      // 正面一扇窗
      dummy.position.set(h.x, h.h * 0.55, h.z);
      dummy.scale.set(1, 1, 1);
      dummy.translateZ(h.d / 2 + 0.006);
      dummy.scale.set(h.w * 0.4, Math.min(0.12, h.h * 0.35), 0.01);
      dummy.updateMatrix();
      win.current.setMatrixAt(i, dummy.matrix);
    });
    win.current.instanceMatrix.needsUpdate = true;
    for (const m of [body.current, roof.current]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }, [world]);
  return (
    <>
      <instancedMesh ref={body} args={[G.box, mat('#ffffff'), world.houses.length]} castShadow receiveShadow />
      <instancedMesh ref={roof} args={[G.prism, mat('#ffffff'), world.houses.length]} castShadow />
      <instancedMesh ref={win} args={[G.box, winMat, world.houses.length]} />
    </>
  );
}

/** 慢慢飄過的低多邊形雲。 */
export function Clouds() {
  const clouds = useMemo(() => Array.from({ length: 7 }, (_, i) => ({
    x: BOUNDS.minX - 6 + ((i * 9.3) % (BOUNDS.maxX - BOUNDS.minX + 12)),
    z: BOUNDS.minZ - 2 + ((i * 5.7) % (BOUNDS.maxZ - BOUNDS.minZ + 4)),
    y: 5.2 + (i % 3) * 0.7,
    s: 0.8 + ((i * 37) % 10) / 14,
    v: 0.18 + ((i * 13) % 7) / 40,
    puffs: [[0, 0, 0, 1], [0.75, -0.12, 0.1, 0.72], [-0.7, -0.15, -0.05, 0.66], [0.25, 0.25, -0.2, 0.6]] as [number, number, number, number][],
  })), []);
  const refs = useRef<THREE.Group[]>([]);
  const span = BOUNDS.maxX - BOUNDS.minX + 14;
  useFrame((_, dt) => {
    if (frozen()) return;
    clouds.forEach((c, i) => {
      const g = refs.current[i];
      if (!g) return;
      g.position.x += c.v * dt;
      if (g.position.x > BOUNDS.maxX + 7) g.position.x -= span;
    });
  });
  const m = mat('#FFFFFF', { transparent: true, opacity: 0.92 });
  return (
    <>
      {clouds.map((c, i) => (
        <group key={i} ref={(g) => { if (g) refs.current[i] = g; }} position={[c.x, c.y, c.z]} scale={c.s}>
          {c.puffs.map(([x, y, z, s], j) => (
            <mesh key={j} geometry={G.ico} material={m} position={[x, y, z]} scale={[s * 1.3, s * 0.8, s]} />
          ))}
        </group>
      ))}
    </>
  );
}

const PETALS = ['#FFFFFF', '#FFD84D', '#FF9DB8', '#B99CF2', '#FF8A65'];
// 花很小，用面數少的球就夠圓了
const FLOWER = new THREE.SphereGeometry(0.5, 8, 6);
/** 草地上的小花：一朵花＝一顆小球，隨風輕擺，開場時一朵朵冒出來。 */
export function Flowers({ world }: { world: World }) {
  const head = useRef<THREE.InstancedMesh>(null!);
  const stem = useRef<THREE.InstancedMesh>(null!);
  useLayoutEffect(() => {
    world.flowers.forEach((f, i) => {
      const y = world.groundY(f.x, f.z);
      dummy.rotation.set(0, 0, 0);
      dummy.position.set(f.x, y, f.z);
      dummy.scale.set(0.025, 0.13 * f.s, 0.025);
      dummy.updateMatrix();
      stem.current.setMatrixAt(i, dummy.matrix);
      dummy.position.set(f.x, y + 0.13 * f.s, f.z);
      dummy.scale.set(0.09 * f.s, 0.06 * f.s, 0.09 * f.s);
      dummy.updateMatrix();
      head.current.setMatrixAt(i, dummy.matrix);
      head.current.setColorAt(i, color.set(PETALS[f.c]));
    });
    stem.current.instanceMatrix.needsUpdate = true;
    head.current.instanceMatrix.needsUpdate = true;
    if (head.current.instanceColor) head.current.instanceColor.needsUpdate = true;
  }, [world]);
  return (
    <>
      <instancedMesh ref={stem} args={[G.cyl6, windMat(C.leaf3, 0.02, 2.4), world.flowers.length]} />
      <instancedMesh ref={head} args={[FLOWER, windMat('#ffffff', 0.03, 2.4), world.flowers.length]} />
    </>
  );
}
