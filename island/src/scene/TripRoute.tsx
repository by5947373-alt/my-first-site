// 小旅行路線：依序連起加入的景點，弧線上有一顆小光點沿著路線前進。
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../store';

export function TripRoute() {
  const trip = useStore((s) => s.trip);
  const show = useStore((s) => s.showRoute);
  const pois = useStore((s) => s.pois);
  const curve = useMemo(() => {
    const stops = trip.map((id) => pois.find((p) => p.id === id)).filter(Boolean) as typeof pois;
    if (stops.length < 2) return null;
    const path = new THREE.CurvePath<THREE.Vector3>();
    for (let i = 1; i < stops.length; i++) {
      const a = new THREE.Vector3(stops[i - 1].pos[0], 0.35, stops[i - 1].pos[1]);
      const b = new THREE.Vector3(stops[i].pos[0], 0.35, stops[i].pos[1]);
      const mid = a.clone().lerp(b, 0.5);
      mid.y += 0.8 + a.distanceTo(b) * 0.18;
      path.add(new THREE.QuadraticBezierCurve3(a, mid, b));
    }
    return path;
  }, [trip, pois]);
  const points = useMemo(() => (curve ? curve.getSpacedPoints(Math.max(40, trip.length * 30)) : []), [curve, trip.length]);
  const line = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const dot = useRef<THREE.Mesh>(null!);
  const k = useRef(0);
  useFrame((_, dt) => {
    if (!curve) return;
    if (line.current?.material) line.current.material.dashOffset -= dt * 0.8;
    k.current = (k.current + dt * (0.6 / Math.max(1, trip.length - 1))) % 1;
    if (dot.current) dot.current.position.copy(curve.getPointAt(k.current));
  });
  if (!show || !curve) return null;
  return (
    <group>
      <Line ref={line} points={points} color="#E07A5F" lineWidth={4.5} dashed dashSize={0.35} gapSize={0.2} transparent opacity={0.95} />
      <mesh ref={dot}>
        <icosahedronGeometry args={[0.16, 1]} />
        <meshBasicMaterial color="#FFE08A" />
      </mesh>
    </group>
  );
}
