import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import { buildWorld } from '../world';
import { useStore } from '../store';
import { WIND } from './kit';
import { Island } from './Island';
import { Trees, Houses, Clouds } from './Nature';
import { Traffic } from './Traffic';
import { Landmarks } from './Landmarks';
import { CameraRig } from './CameraRig';
import { TripRoute } from './TripRoute';

export function Scene({ interactive, zoomable, mobile }: { interactive: boolean; zoomable: boolean; mobile: boolean }) {
  const pois = useStore((s) => s.pois);
  const world = useMemo(() => buildWorld(pois), [pois]);
  const gl = useThree((s) => s.gl);

  // 嵌在頁面裡（手機）時，讓手指可以照常捲動頁面
  useEffect(() => { gl.domElement.style.touchAction = interactive ? 'none' : 'pan-y'; }, [interactive, gl]);

  useFrame((_, dt) => { if (!useStore.getState().reduced) WIND.value += Math.min(dt, 0.1); });

  const shadow = mobile ? 1024 : 2048;
  return (
    <>
      <hemisphereLight args={['#FFF7E6', '#C9D9B0', 1.25]} />
      <directionalLight
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
        shadow-camera-far={80}
        shadow-bias={-0.0008}
        shadow-normalBias={0.03}
      />
      <ambientLight intensity={0.25} />
      <Island world={world} />
      <Houses world={world} />
      <Trees world={world} />
      <Landmarks pois={pois} world={world} />
      <Traffic world={world} />
      <Clouds />
      <TripRoute />
      {/* 島嶼漂浮在奶油色背景上的柔和投影（只算一次） */}
      <ContactShadows position={[0, -2.4, 0.6]} scale={[52, 36]} blur={3.2} opacity={0.32} far={4} frames={1} color="#8A6A3E" resolution={512} />
      <CameraRig interactive={interactive} zoomable={zoomable} />
    </>
  );
}
