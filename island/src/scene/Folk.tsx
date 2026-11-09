// 島上的小居民：大大的圓頭、小小的身體，走路一蹦一跳。
// 父元件每格更新 gait（走了多遠、有沒有在走），小人自己算出跳躍、擠壓和擺手。
import { forwardRef, useImperativeHandle, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import gsap from 'gsap';
import { G, mat } from './kit';
import { frozen } from '../store';

export interface Gait { phase: number; moving: boolean }
export interface ChibiHandle { cheer: () => void }

const SKINS = ['#F6D3B5', '#EDC09A', '#F9DDC6', '#D9A47C'];
const HAIRS = ['#5A3B2A', '#2F2A28', '#8B5A3C', '#C9874F', '#3D3A4E'];

export const Chibi = forwardRef<ChibiHandle, {
  shirt: string; seed?: number; gait?: { current: Gait }; sitting?: boolean; children?: ReactNode;
}>(function Chibi({ shirt, seed = 0, gait, sitting, children }, ref) {
  const root = useRef<THREE.Group>(null!);
  const body = useRef<THREE.Group>(null!);
  const legL = useRef<THREE.Mesh>(null!), legR = useRef<THREE.Mesh>(null!);
  const armL = useRef<THREE.Mesh>(null!), armR = useRef<THREE.Mesh>(null!);
  const skin = SKINS[seed % SKINS.length], hair = HAIRS[(seed * 3 + 1) % HAIRS.length];

  // 被點到：開心地跳起來轉一圈
  useImperativeHandle(ref, () => ({
    cheer: () => {
      const tl = gsap.timeline();
      tl.to(root.current.position, { y: 0.22, duration: 0.18, ease: 'power2.out' })
        .to(root.current.rotation, { y: '+=' + Math.PI * 2, duration: 0.4, ease: 'power2.inOut' }, 0)
        .to(root.current.position, { y: 0, duration: 0.35, ease: 'bounce.out' }, 0.18);
    },
  }));

  useFrame(() => {
    if (frozen()) return;
    const g = gait?.current;
    const ph = g ? g.phase : 0;
    const moving = !!g?.moving;
    const hop = moving && !sitting ? Math.abs(Math.sin(ph)) : 0;
    body.current.position.y = hop * 0.045;
    // 落地時壓扁、騰空時拉長
    const sq = moving && !sitting ? Math.cos(ph * 2) * 0.07 : 0;
    body.current.scale.set(1 - sq * 0.5, 1 + sq, 1 - sq * 0.5);
    const sw = moving ? Math.sin(ph) : 0;
    legL.current.position.x = sw * 0.035; legR.current.position.x = -sw * 0.035;
    armL.current.position.x = -sw * 0.03; armR.current.position.x = sw * 0.03;
  });

  return (
    <group ref={root}>
      <group ref={body}>
        <mesh ref={legL} geometry={G.sph} material={mat('#4A4F5C')} position={[0, sitting ? 0.05 : 0.025, 0.035]} scale={[0.06, 0.05, 0.05]} castShadow />
        <mesh ref={legR} geometry={G.sph} material={mat('#4A4F5C')} position={[0, sitting ? 0.05 : 0.025, -0.035]} scale={[0.06, 0.05, 0.05]} castShadow />
        <mesh geometry={G.sph} material={mat(shirt)} position={[0, 0.1, 0]} scale={[0.12, 0.13, 0.12]} castShadow />
        <mesh ref={armL} geometry={G.sph} material={mat(shirt)} position={[0, 0.11, 0.07]} scale={0.045} />
        <mesh ref={armR} geometry={G.sph} material={mat(shirt)} position={[0, 0.11, -0.07]} scale={0.045} />
        {/* 大大的圓頭 */}
        <mesh geometry={G.sph} material={mat(skin)} position={[0, 0.25, 0]} scale={0.2} castShadow />
        <mesh geometry={G.dome} material={mat(hair)} position={[-0.012, 0.262, 0]} scale={[0.212, 0.2, 0.212]} rotation={[0, 0, 0.35]} />
        {/* 眼睛和腮紅（臉朝 +x，也就是前進方向） */}
        <mesh geometry={G.sph} material={mat('#2B2622')} position={[0.094, 0.25, 0.033]} scale={[0.016, 0.03, 0.02]} />
        <mesh geometry={G.sph} material={mat('#2B2622')} position={[0.094, 0.25, -0.033]} scale={[0.016, 0.03, 0.02]} />
        <mesh geometry={G.sph} material={mat('#FF9DA8')} position={[0.085, 0.225, 0.058]} scale={[0.015, 0.018, 0.026]} />
        <mesh geometry={G.sph} material={mat('#FF9DA8')} position={[0.085, 0.225, -0.058]} scale={[0.015, 0.018, 0.026]} />
        {children}
      </group>
    </group>
  );
});
