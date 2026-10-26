import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * 3D Mobile Robot Mesh with Kinematic Pose Representation.
 * Displays a differential-drive robot with circular chassis, drive wheels,
 * front caster, directional LIDAR tower, and orientation vector.
 */
export function RobotMesh({
  pose = { x: 0, z: 0, theta: 0 },
  model = 'differential',
  radius = 0.45,
  color = '#38bdf8',
  showHeading = true,
  showFootprint = true,
}) {
  const groupRef = useRef();
  const wheelLRef = useRef();
  const wheelRRef = useRef();
  const lidarRef = useRef();

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // Smoothly position robot at pose (y is up in Three.js coordinate system; x, z on floor)
    groupRef.current.position.x = pose.x;
    groupRef.current.position.z = pose.z;
    groupRef.current.position.y = 0.12; // Wheels rest on ground y=0

    // Smooth orientation interpolation: target is -pose.theta + Math.PI / 2
    const targetRot = -pose.theta + Math.PI / 2;
    let diff = (targetRot - groupRef.current.rotation.y) % (Math.PI * 2);
    if (diff > Math.PI) diff -= Math.PI * 2;
    if (diff < -Math.PI) diff += Math.PI * 2;
    groupRef.current.rotation.y += diff * Math.min(1, delta * 12);

    // Spin wheels and LIDAR if moving
    if (pose.v && Math.abs(pose.v) > 0.01) {
      const wheelSpin = (pose.v / 0.12) * delta;
      if (wheelLRef.current) wheelLRef.current.rotation.x += wheelSpin;
      if (wheelRRef.current) wheelRRef.current.rotation.x += wheelSpin;
    }

    if (lidarRef.current) {
      lidarRef.current.rotation.y += delta * 6; // 360 deg continuous spin
    }
  });

  const bodyHeight = 0.22;
  const wheelRadius = 0.12;
  const wheelWidth = 0.05;
  const wheelOffset = radius * 0.85;

  return (
    <group ref={groupRef} position={[pose.x, 0.12, pose.z]}>
      {/* Robot Footprint Projection Ring on Floor */}
      {showFootprint && (
        <mesh position={[0, -0.119, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[radius - 0.02, radius + 0.01, 32]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.35}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Main Cylindrical Chassis */}
      <mesh position={[0, bodyHeight / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius, radius, bodyHeight, 32]} />
        <meshStandardMaterial
          color="#0f172a"
          metalness={0.7}
          roughness={0.3}
          envMapIntensity={1}
        />
      </mesh>

      {/* Chassis Top Accent Deck */}
      <mesh position={[0, bodyHeight + 0.01, 0]}>
        <cylinderGeometry args={[radius * 0.9, radius * 0.9, 0.02, 32]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} />
      </mesh>

      {/* LIDAR Sensor Turret */}
      <group position={[0, bodyHeight + 0.04, 0]}>
        <mesh position={[0, 0.04, 0]}>
          <cylinderGeometry args={[0.09, 0.11, 0.08, 16]} />
          <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh ref={lidarRef} position={[0, 0.09, 0]}>
          <cylinderGeometry args={[0.07, 0.07, 0.04, 16]} />
          <meshStandardMaterial
            color="#22d3ee"
            emissive="#00f0ff"
            emissiveIntensity={0.8}
          />
        </mesh>
      </group>

      {/* Left Drive Wheel */}
      <group position={[-wheelOffset, 0, 0]}>
        <group ref={wheelLRef}>
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[wheelRadius, wheelRadius, wheelWidth, 24]} />
            <meshStandardMaterial color="#334155" roughness={0.7} />
          </mesh>
        </group>
      </group>

      {/* Right Drive Wheel */}
      <group position={[wheelOffset, 0, 0]}>
        <group ref={wheelRRef}>
          <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[wheelRadius, wheelRadius, wheelWidth, 24]} />
            <meshStandardMaterial color="#334155" roughness={0.7} />
          </mesh>
        </group>
      </group>

      {/* Front Passive Caster Ball */}
      <mesh position={[0, -0.06, radius * 0.72]}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Rear Passive Caster Ball */}
      <mesh position={[0, -0.06, -radius * 0.72]}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Directional Heading Arrow pointing toward front (+Z) */}
      {showHeading && (
        <group position={[0, bodyHeight + 0.03, radius * 0.5]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.08, 0.22, 16]} />
            <meshStandardMaterial
              color="#00ff88"
              emissive="#00ff88"
              emissiveIntensity={0.6}
            />
          </mesh>
        </group>
      )}

      {/* Glow Beacon Light */}
      <pointLight color={color} intensity={0.6} distance={2.5} position={[0, 0.4, 0]} />
    </group>
  );
}

export default RobotMesh;
