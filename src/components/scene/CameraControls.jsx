import React, { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

export function CameraControls({
  cameraMode = 'isometric', // 'perspective' | 'isometric' | 'top' | 'front' | 'side' | 'follow'
  robotPose = { x: 0, z: 0 },
  enabled = true,
  controlsRef = null,
}) {
  const localRef = useRef();
  const controls = controlsRef || localRef;
  const { camera } = useThree();

  useEffect(() => {
    if (!controls.current) return;

    if (cameraMode === 'top') {
      camera.position.set(0, 21, 0.01);
      controls.current.target.set(0, 0, 0);
      controls.current.update();
    } else if (cameraMode === 'front') {
      camera.position.set(0, 7, 19);
      controls.current.target.set(0, 0, 0);
      controls.current.update();
    } else if (cameraMode === 'side') {
      camera.position.set(19, 7, 0);
      controls.current.target.set(0, 0, 0);
      controls.current.update();
    } else if (cameraMode === 'isometric') {
      camera.position.set(13, 14, 13);
      controls.current.target.set(0, 0, 0);
      controls.current.update();
    } else if (cameraMode === 'perspective') {
      camera.position.set(0, 15, 16);
      controls.current.target.set(0, 0, 0);
      controls.current.update();
    }
  }, [cameraMode, camera, controls]);

  useFrame(() => {
    if (cameraMode === 'follow' && controls.current && robotPose) {
      controls.current.target.lerp(new THREE.Vector3(robotPose.x, 0, robotPose.z), 0.08);
      controls.current.update();
    }
  });

  return (
    <OrbitControls
      ref={controls}
      enabled={enabled}
      makeDefault
      enableDamping
      dampingFactor={0.06}
      maxPolarAngle={Math.PI / 2 - 0.04}
      minDistance={3}
      maxDistance={48}
    />
  );
}

export default CameraControls;
