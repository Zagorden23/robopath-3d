import React from 'react';
import { Edges } from '@react-three/drei';
import * as THREE from 'three';

export function ObstacleMesh({ obstacle, isSelected = false, onSelect = null }) {
  const {
    id,
    label,
    shape = 'box',
    x = 0,
    z = 0,
    width = 1.5,
    depth = 1.5,
    radius = 0.75,
    height = 2.0,
    color = '#38bdf8',
  } = obstacle;

  const yPos = height / 2;

  const handleClick = (e) => {
    e.stopPropagation();
    if (onSelect) onSelect(obstacle);
  };

  if (shape === 'cylinder') {
    const r = radius || width / 2;
    return (
      <group position={[x, 0, z]}>
        {/* Floor collision footprint indicator */}
        <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[r, 32]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.15}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* 3D Cylinder Mesh */}
        <mesh
          position={[0, yPos, 0]}
          onClick={handleClick}
          castShadow
          receiveShadow
        >
          <cylinderGeometry args={[r, r, height, 32]} />
          <meshStandardMaterial
            color={isSelected ? '#f43f5e' : color}
            roughness={0.4}
            metalness={0.3}
            transparent
            opacity={0.9}
          />
          <Edges
            threshold={15}
            color={isSelected ? '#fda4af' : '#ffffff'}
            lineWidth={isSelected ? 2 : 1}
          />
        </mesh>
      </group>
    );
  }

  // Box Obstacle
  return (
    <group position={[x, 0, z]}>
      {/* Floor footprint outline */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.15}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* 3D Box Mesh */}
      <mesh
        position={[0, yPos, 0]}
        onClick={handleClick}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial
          color={isSelected ? '#f43f5e' : color}
          roughness={0.4}
          metalness={0.3}
          transparent
          opacity={0.9}
        />
        <Edges
          threshold={15}
          color={isSelected ? '#fda4af' : '#ffffff'}
          lineWidth={isSelected ? 2 : 1}
        />
      </mesh>
    </group>
  );
}

export default ObstacleMesh;
