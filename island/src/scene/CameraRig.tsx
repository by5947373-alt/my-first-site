// 等角正交鏡頭：自由旋轉、縮放，點擊景點時平滑飛過去。
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OC } from 'three-stdlib';
import * as THREE from 'three';
import gsap from 'gsap';
import { BOUNDS, LAND } from '../geo';
import { useStore, poiById } from '../store';
import { MODELS } from './models';
import { PLAYER } from './Avatar';
import { ISLETS } from '../avatar';

// 鏡頭可以平移的範圍：主島加上附近的小島
const PAN = ISLETS.reduce((b, it) => ({
  minX: Math.min(b.minX, it.pos[0]), maxX: Math.max(b.maxX, it.pos[0]),
  minZ: Math.min(b.minZ, it.pos[1]), maxZ: Math.max(b.maxZ, it.pos[1]),
}), { ...BOUNDS });

const CENTER = new THREE.Vector3((BOUNDS.minX + BOUNDS.maxX) / 2, 0, (BOUNDS.minZ + BOUNDS.maxZ) / 2 + 0.6);
// 預設視角：從南南東方斜上俯瞰（北方在畫面上方），接近等角透視
const dirAt = (az: number) => new THREE.Vector3(Math.sin(az), 0.92, Math.cos(az)).normalize();
const LAND_DIR = dirAt(0.32);
// 直式手機螢幕：鏡頭轉到東南側，讓東西狹長的島嶼直立擺放、塞滿畫面
const PORTRAIT_DIR = dirAt(0.32 + 1.3);
const DIST = 60;
// 畫面左側若有固定的介面，可以預留寬度（目前沒有）
const LEFT_UI = 0;
const TOP_DIR = new THREE.Vector3(0, 1, 0.02).normalize();

/** 目前的鏡頭（拍照時用來找角色在畫面上的位置） */
export const CAM: { cam: THREE.Camera | null } = { cam: null };

export function CameraRig({ interactive, zoomable }: { interactive: boolean; zoomable: boolean }) {
  const { camera, size } = useThree();
  const ctl = useRef<OC>(null!);
  const cam = camera as THREE.OrthographicCamera;
  CAM.cam = cam;
  const tween = useRef<gsap.core.Tween | null>(null);

  const HOME_DIR = size.width / size.height < 0.85 ? PORTRAIT_DIR : LAND_DIR;
  /** 讓整座島剛好塞進畫面的縮放值。 */
  const fit = useMemo(() => {
    const m = new THREE.Matrix4().lookAt(HOME_DIR, new THREE.Vector3(), new THREE.Vector3(0, 1, 0)).invert();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    const v = new THREE.Vector3();
    // 主島＋周圍小島都要放得進畫面
    const pts: [number, number][] = [...LAND];
    for (const it of ISLETS) for (const a of [0, 1.57, 3.14, 4.71]) pts.push([it.pos[0] + Math.cos(a) * it.r, it.pos[1] + Math.sin(a) * it.r]);
    for (const [x, z] of pts) for (const y of [0.4, -1.2]) {
      v.set(x - CENTER.x, y, z - CENTER.z).applyMatrix4(m);
      x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
    }
    const w = size.width - (size.width >= 720 ? LEFT_UI : 0);
    const portrait = HOME_DIR === PORTRAIT_DIR;
    return Math.min(w / ((x1 - x0) * (portrait ? 1.12 : 1.04)), (size.height - (portrait ? 150 : 0)) / ((y1 - y0) * (portrait ? 1.05 : 1.22)));
  }, [size.width, size.height, HOME_DIR]);

  /** 全景時的鏡頭目標：桌機左邊有分類按鈕，島嶼往右挪一點。 */
  const home = () => {
    if (size.width < 720) return CENTER.clone().add(new THREE.Vector3(0, 0, 0.6));
    const right = new THREE.Vector3(HOME_DIR.z, 0, -HOME_DIR.x).normalize();
    return CENTER.clone().addScaledVector(right, -(LEFT_UI / 2) / fit);
  };

  // 初次載入與視窗大小改變：回到全景
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      const h = home();
      cam.position.copy(h).addScaledVector(HOME_DIR, DIST);
      cam.zoom = fit * 0.6;
      cam.lookAt(h);
      cam.updateProjectionMatrix();
      ctl.current?.target.copy(h);
      // 開場：從遠處緩緩推近
      fly(h, fit, HOME_DIR, 1.8);
    } else if (!useStore.getState().selected) {
      fly(home(), fit, null, 0.6);
    }
  }, [fit]); // eslint-disable-line react-hooks/exhaustive-deps

  function fly(target: THREE.Vector3, zoom: number, dir: THREE.Vector3 | null, dur = 1.2) {
    const c = ctl.current;
    if (!c) return;
    tween.current?.kill();
    const reduced = useStore.getState().reduced;
    const from = { tx: c.target.x, ty: c.target.y, tz: c.target.z, z: cam.zoom };
    const offset = cam.position.clone().sub(c.target);
    const len = offset.length();
    const d0 = offset.clone().normalize();
    const d1 = dir ? dir.clone() : d0.clone();
    const st = { k: 0 };
    tween.current = gsap.to(st, {
      k: 1, duration: reduced ? 0.01 : dur, ease: 'power3.inOut',
      onUpdate: () => {
        const k = st.k;
        c.target.set(from.tx + (target.x - from.tx) * k, from.ty + (target.y - from.ty) * k, from.tz + (target.z - from.tz) * k);
        const d = d0.clone().lerp(d1, k).normalize();
        cam.position.copy(c.target).addScaledVector(d, len);
        cam.zoom = from.z + (zoom - from.z) * k;
        cam.updateProjectionMatrix();
        c.update();
      },
    });
  }

  // 選取景點 → 鏡頭聚焦；回到全景
  useEffect(() => useStore.subscribe((s, prev) => {
    if (s.selected !== prev.selected && s.selected) {
      const p = poiById(s.selected);
      if (!p) return;
      const h = MODELS[p.model].h;
      // 手機的資訊卡在下方，鏡頭目標往下偏一點，讓建築落在卡片上方
      const mobile = size.width < 720;
      const tgt = new THREE.Vector3(p.pos[0], h * 0.35, p.pos[1]);
      const z = Math.max(cam.zoom, fit * (mobile ? 3.2 : 3.4));
      if (mobile) {
        const off = cam.position.clone().sub(ctl.current.target).setY(0).normalize();
        tgt.addScaledVector(off, (size.height * 0.2) / z);
      }
      fly(tgt, z, null, 1.3);
    }
    if (s.homeTick !== prev.homeTick) fly(home(), fit, s.aerial ? TOP_DIR : HOME_DIR, 1.2);
    // 我的角色：打開角色面板、換地點、換拍照構圖時，鏡頭飛到角色身邊
    if (s.meTick !== prev.meTick || (s.shot !== prev.shot && s.panel === 'character')) setTimeout(() => toPlayer(useStore.getState().shot), 60);
    // 鳥瞰：鏡頭轉到正上方往下看；再按一次回到斜角
    if (s.aerial !== prev.aerial) fly(ctl.current.target.clone(), cam.zoom, s.aerial ? TOP_DIR : HOME_DIR, 1.1);
  }), [fit, size.width, size.height]); // eslint-disable-line react-hooks/exhaustive-deps

  function toPlayer(shot: string) {
    const c = ctl.current;
    if (!c) return;
    const flat = cam.position.clone().sub(c.target).setY(0);
    if (flat.lengthSq() < 0.01) flat.set(HOME_DIR.x, 0, HOME_DIR.z);
    flat.normalize();
    const mobile = size.width < 900;
    let dir: THREE.Vector3, zoom: number, lift = 0.55;
    if (shot === '從上面拍') { dir = TOP_DIR.clone(); zoom = fit * 5; lift = 0.2; }
    else if (shot === '與島合照') { dir = flat.clone().setY(0.62).normalize(); zoom = fit * 2.6; }
    else { dir = flat.clone().setY(0.7).normalize(); zoom = fit * 11; }
    const tgt = PLAYER.clone().add(new THREE.Vector3(0, lift, 0));
    // 手機的角色面板在下方：目標往下偏，讓角色落在面板上方
    if (mobile) tgt.addScaledVector(flat, (size.height * 0.24) / zoom);
    fly(tgt, zoom, dir, 1.3);
  }

  // 平移不能把島拖出畫面；縮放程度回報給標籤（拉近才顯示市區小店名稱）
  useFrame(() => {
    const c = ctl.current;
    if (!c) return;
    const t = c.target;
    // 角色沿著小旅行走時，鏡頭跟著走
    if (useStore.getState().walking) {
      const dx = (PLAYER.x - t.x) * 0.06, dz = (PLAYER.z - t.z) * 0.06;
      t.x += dx; t.z += dz; cam.position.x += dx; cam.position.z += dz;
    }
    const cx = THREE.MathUtils.clamp(t.x, PAN.minX, PAN.maxX), cz = THREE.MathUtils.clamp(t.z, PAN.minZ, PAN.maxZ);
    if (cx !== t.x || cz !== t.z) { cam.position.x += cx - t.x; cam.position.z += cz - t.z; t.x = cx; t.z = cz; }
    // 指北針跟著鏡頭轉
    const n = document.querySelector<HTMLElement>('.isl-compass i');
    if (n) n.style.transform = `rotate(${(c.getAzimuthalAngle() * 180) / Math.PI}deg)`;
    const close = cam.zoom > fit * 2.2;
    if (close !== useStore.getState().closeUp) useStore.getState().set({ closeUp: close });
  });

  return (
    <OrbitControls
      ref={ctl}
      makeDefault
      enabled={interactive}
      enableZoom={zoomable}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.6}
      zoomSpeed={0.9}
      minZoom={fit * 0.75}
      maxZoom={fit * 12}
      minPolarAngle={0}
      maxPolarAngle={1.18}
      screenSpacePanning={false}
      onStart={() => tween.current?.kill()}
    />
  );
}
