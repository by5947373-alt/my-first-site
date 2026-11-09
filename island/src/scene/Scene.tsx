import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import { buildWorld } from '../world';
import { useStore, frozen } from '../store';
import { GROW, WIND } from './kit';
import { Island } from './Island';
import { Trees, Houses, Clouds, Flowers } from './Nature';
import { Traffic } from './Traffic';
import { Landmarks } from './Landmarks';
import { CameraRig } from './CameraRig';
import { TripRoute } from './TripRoute';
import { Lighting, StreetLamps } from './Lighting';
import { LinkLines, Carriers } from './Links';

export function Scene({ interactive, zoomable, mobile }: { interactive: boolean; zoomable: boolean; mobile: boolean }) {
  const pois = useStore((s) => s.pois);
  const world = useMemo(() => buildWorld(pois), [pois]);
  const gl = useThree((s) => s.gl);

  // 嵌在頁面裡（手機）時，讓手指可以照常捲動頁面
  useEffect(() => { gl.domElement.style.touchAction = interactive ? 'none' : 'pan-y'; }, [interactive, gl]);

  useFrame((_, dt) => {
    if (!frozen()) WIND.value += Math.min(dt, 0.1);
    // 開場：樹、房子、花、田一個個長出來（減少動態時直接全部出現）
    GROW.value = useStore.getState().reduced ? 99 : GROW.value + Math.min(dt, 0.05);
  });

  const shadow = mobile ? 1024 : 2048;
  return (
    <>
      <Lighting shadow={shadow} />
      <StreetLamps spots={world.lamps} />
      <Island world={world} />
      <Houses world={world} />
      <Trees world={world} />
      <Flowers world={world} />
      <Landmarks pois={pois} world={world} />
      <Traffic world={world} />
      <Clouds />
      <TripRoute />
      <LinkLines />
      <Carriers />
      {/* 島嶼漂浮在奶油色背景上的柔和投影（只算一次） */}
      <ContactShadows position={[0, -2.4, 0.6]} scale={[52, 36]} blur={3.2} opacity={0.32} far={4} frames={1} color="#8A6A3E" resolution={512} />
      <CameraRig interactive={interactive} zoomable={zoomable} />
    </>
  );
}
