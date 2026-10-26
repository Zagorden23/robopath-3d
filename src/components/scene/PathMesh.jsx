import React, { useMemo } from 'react';
import * as THREE from 'three';

export function PathMesh({
  path = [],
  start = { x: 0, z: 0 },
  goal = { x: 0, z: 0 },
  showPath = true,
  showWaypoints = true,
  pathColor = '#00ff88',
  altPath = null,
  altPathColor = '#818cf8',
}) {
  // Convert path coordinates [[x,z], ...] or [{x,z}, ...] into 3D points
  const points = useMemo(() => {
    if (!path || path.length < 2) return [];
    return path.map((pt) => {
      const x = Array.isArray(pt) ? pt[0] : pt.x;
      const z = Array.isArray(pt) ? pt[1] : (pt.z !== undefined ? pt.z : pt.y);
      return new THREE.Vector3(x, 0.05, z);
    });
  }, [path]);

  const curve = useMemo(() => {
    if (points.length < 2) return null;
    const curvePath = new THREE.CurvePath();
    for (let i = 0; i < points.length - 1; i++) {
      curvePath.add(new THREE.LineCurve3(points[i], points[i + 1]));
    }
    return curvePath;
  }, [points]);

  const altPoints = useMemo(() => {
    if (!altPath || altPath.length < 2) return [];
    return altPath.map((pt) => {
      const x = Array.isArray(pt) ? pt[0] : pt.x;
      const z = Array.isArray(pt) ? pt[1] : pt.z;
      return new THREE.Vector3(x, 0.07, z);
    });
  }, [altPath]);

  return (
    <group>
      {/* START POSITION MARKER */}
      {start && (
        <group position={[start.x, 0, start.z]}>
          {/* Floor target ring */}
          <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.35, 0.45, 32]} />
            <meshBasicMaterial color="#38bdf8" side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.2, 16]} />
            <meshBasicMaterial color="#38bdf8" transparent opacity={0.4} />
          </mesh>
          {/* Start Beacon Pole */}
          <mesh position={[0, 0.5, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 1.0, 16]} />
            <meshStandardMaterial color="#0284c7" metalness={0.7} />
          </mesh>
          <mesh position={[0, 1.0, 0]}>
            <sphereGeometry args={[0.1, 16, 16]} />
            <meshStandardMaterial
              color="#38bdf8"
              emissive="#38bdf8"
              emissiveIntensity={0.8}
            />
          </mesh>
        </group>
      )}

      {/* GOAL POSITION MARKER */}
      {goal && (
        <group position={[goal.x, 0, goal.z]}>
          {/* Floor target ring */}
          <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.45, 0.58, 32]} />
            <meshBasicMaterial color="#00ff88" side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.3, 16]} />
            <meshBasicMaterial color="#00ff88" transparent opacity={0.35} />
          </mesh>
          {/* Goal Beacon Tower */}
          <mesh position={[0, 0.65, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 1.3, 16]} />
            <meshStandardMaterial color="#059669" metalness={0.8} />
          </mesh>
          <mesh position={[0, 1.35, 0]}>
            <octahedronGeometry args={[0.15]} />
            <meshStandardMaterial
              color="#00ff88"
              emissive="#00ff88"
              emissiveIntensity={1.0}
            />
          </mesh>
          <pointLight color="#00ff88" intensity={0.8} distance={3} position={[0, 1.2, 0]} />
        </group>
      )}

      {/* PLANNED 3D PATH TUBE */}
      {showPath && curve && (
        <mesh>
          <tubeGeometry args={[curve, Math.max(64, points.length * 6), 0.045, 8, false]} />
          <meshStandardMaterial
            color={pathColor}
            emissive={pathColor}
            emissiveIntensity={0.65}
            roughness={0.2}
          />
        </mesh>
      )}

      {/* ALTERNATIVE COMPARISON PATH (if active) */}
      {showPath && altPoints.length >= 2 && (
        <line>
          <bufferGeometry
            attach="geometry"
            {...new THREE.BufferGeometry().setFromPoints(altPoints)}
          />
          <lineBasicMaterial color={altPathColor} linewidth={3} />
        </line>
      )}

      {/* DISCRETE WAYPOINTS */}
      {showPath && showWaypoints && points.map((pt, idx) => (
        <mesh key={`wp-${idx}`} position={[pt.x, 0.1, pt.z]}>
          <sphereGeometry args={[0.07, 12, 12]} />
          <meshStandardMaterial
            color={idx === 0 ? '#38bdf8' : idx === points.length - 1 ? '#00ff88' : '#ffffff'}
            emissive={pathColor}
            emissiveIntensity={0.4}
          />
        </mesh>
      ))}
    </group>
  );
}

export default PathMesh;
