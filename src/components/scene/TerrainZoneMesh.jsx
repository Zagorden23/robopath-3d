import React from 'react';
import * as THREE from 'three';

export function TerrainZoneMesh({ zone }) {
  const {
    label = 'Weighted Zone',
    x = 0,
    z = 0,
    width = 4,
    depth = 4,
    costMultiplier = 2.5,
    color = '#f59e0b',
  } = zone;

  return (
    <group position={[x, 0.02, z]}>
      {/* Translucent ground slab */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.3}
          roughness={0.8}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Border Outline */}
      <lineSegments>
        <edgesGeometry args={[new THREE.PlaneGeometry(width, depth)]} />
        <lineBasicMaterial color={color} linewidth={2} />
      </lineSegments>
    </group>
  );
}

export default TerrainZoneMesh;
