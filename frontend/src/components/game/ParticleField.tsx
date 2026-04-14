import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function Particles() {
  const ref = useRef<THREE.Points>(null);
  const count = 150;
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) arr[i] = (Math.random() - 0.5) * 10;
    return arr;
  }, []);

  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.getElapsedTime() * 0.05;
      ref.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.03) * 0.1;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.03} color="#00E5FF" transparent opacity={0.8} sizeAttenuation />
    </points>
  );
}

export const ParticleField = () => (
  <div className="absolute inset-0 opacity-60">
    <Canvas camera={{ position: [0, 0, 5], fov: 60 }} dpr={[1, 1.5]}>
      <Particles />
    </Canvas>
  </div>
);
