import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
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
import { Ocean } from './Ocean';
import { Player } from './Avatar';

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
      <Ocean />
      <Player world={world} />
      <TripRoute />
      <LinkLines />
      <Carriers />
      <CameraRig interactive={interactive} zoomable={zoomable} />
    </>
  );
}
