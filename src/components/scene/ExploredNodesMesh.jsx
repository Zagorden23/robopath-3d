import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';

export function ExploredNodesMesh({
  visited = [],
  tree = [],
  algorithm = 'ASTAR',
  cellSize = 0.75,
  showExplored = true,
  showTree = true,
  maxVisible = 2500,
}) {
  const meshRef = useRef();

  // Grid search visited points: array of [x, z] or {x, z}
  const gridPoints = useMemo(() => {
    if (!showExplored || !visited || visited.length === 0) return [];
    const sliced = visited.slice(0, maxVisible);
    return sliced.map((p) => ({
      x: Array.isArray(p) ? p[0] : p.x,
      z: Array.isArray(p) ? p[1] : p.z,
    }));
  }, [visited, showExplored, maxVisible]);

  const tileScale = Math.max(0.22, cellSize * 0.84);

  // Update instanced mesh transforms
  useEffect(() => {
    if (!meshRef.current || gridPoints.length === 0) return;

    const dummy = new THREE.Object3D();
    const count = gridPoints.length;

    for (let i = 0; i < count; i++) {
      const pt = gridPoints[i];
      dummy.position.set(pt.x, 0.025, pt.z);
      dummy.rotation.x = -Math.PI / 2;
      dummy.scale.set(tileScale, tileScale, 1);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [gridPoints, tileScale]);

  // RRT / RRT* Tree Lines: supports { fromX, fromZ, toX, toZ }, { from: {x,z}, to: {x,z} }, and [[x1,z1],[x2,z2]]
  const rrtLines = useMemo(() => {
    if (!showTree || !tree || tree.length === 0) return [];
    const pts = [];
    for (const edge of tree) {
      if (Number.isFinite(edge.fromX) && Number.isFinite(edge.toX)) {
        pts.push(new THREE.Vector3(edge.fromX, 0.06, edge.fromZ));
        pts.push(new THREE.Vector3(edge.toX, 0.06, edge.toZ));
      } else if (edge.from && edge.to) {
        const x1 = Array.isArray(edge.from) ? edge.from[0] : edge.from.x;
        const z1 = Array.isArray(edge.from) ? (edge.from[1] ?? 0) : (edge.from.z ?? edge.from.y ?? 0);
        const x2 = Array.isArray(edge.to) ? edge.to[0] : edge.to.x;
        const z2 = Array.isArray(edge.to) ? (edge.to[1] ?? 0) : (edge.to.z ?? edge.to.y ?? 0);
        if (Number.isFinite(x1) && Number.isFinite(z1) && Number.isFinite(x2) && Number.isFinite(z2)) {
          pts.push(new THREE.Vector3(x1, 0.06, z1));
          pts.push(new THREE.Vector3(x2, 0.06, z2));
        }
      } else if (Array.isArray(edge) && edge.length >= 2) {
        const p1 = edge[0];
        const p2 = edge[1];
        const x1 = Array.isArray(p1) ? p1[0] : p1.x;
        const z1 = Array.isArray(p1) ? p1[1] : (p1.z ?? p1.y ?? 0);
        const x2 = Array.isArray(p2) ? p2[0] : p2.x;
        const z2 = Array.isArray(p2) ? p2[1] : (p2.z ?? p2.y ?? 0);
        if (Number.isFinite(x1) && Number.isFinite(z1) && Number.isFinite(x2) && Number.isFinite(z2)) {
          pts.push(new THREE.Vector3(x1, 0.06, z1));
          pts.push(new THREE.Vector3(x2, 0.06, z2));
        }
      }
    }
    return pts;
  }, [tree, showTree]);

  const rrtGeometry = useMemo(() => {
    if (rrtLines.length === 0) return null;
    return new THREE.BufferGeometry().setFromPoints(rrtLines);
  }, [rrtLines]);

  return (
    <group>
      {/* Grid-based Explored Cells (BFS / Dijkstra / A* / Greedy) */}
      {showExplored && gridPoints.length > 0 && (
        <instancedMesh
          key={`visited-${gridPoints.length}`}
          ref={meshRef}
          args={[null, null, gridPoints.length]}
          frustumCulled={false}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            color={
              algorithm === 'ASTAR'
                ? '#0284c7'
                : algorithm === 'BFS'
                ? '#0d9488'
                : algorithm === 'GREEDY'
                ? '#d97706'
                : '#059669'
            }
            transparent
            opacity={0.32}
            side={THREE.DoubleSide}
          />
        </instancedMesh>
      )}

      {/* Continuous RRT / RRT* Tree Branches */}
      {showTree && rrtGeometry && (
        <lineSegments geometry={rrtGeometry}>
          <lineBasicMaterial color="#0284c7" transparent opacity={0.65} linewidth={2} />
        </lineSegments>
      )}
    </group>
  );
}

export default ExploredNodesMesh;
