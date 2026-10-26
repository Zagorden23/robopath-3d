import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Grid } from '@react-three/drei';
import * as THREE from 'three';
import RobotMesh from './RobotMesh.jsx';
import ObstacleMesh from './ObstacleMesh.jsx';
import TerrainZoneMesh from './TerrainZoneMesh.jsx';
import PathMesh from './PathMesh.jsx';
import ExploredNodesMesh from './ExploredNodesMesh.jsx';
import CameraControls from './CameraControls.jsx';
import { cellToWorld, worldToCell } from '../../context/SimulationContext.jsx';

const SURFACE_PALETTES = {
  'lemon-ivory': {
    sky: '#f3eed8',
    fog: '#f3eed8',
    floor: '#fcf9ec',
    border: '#0d9488',
    gridCell: '#cbd5e1',
    gridSection: '#0d9488',
    wallColor: '#1f4e5f',
    wallCap: '#0d9488',
  },
  'warm-sand': {
    sky: '#ede5cb',
    fog: '#ede5cb',
    floor: '#f8f2de',
    border: '#b45309',
    gridCell: '#d6cbb5',
    gridSection: '#d97706',
    wallColor: '#334155',
    wallCap: '#d97706',
  },
  'blueprint-day': {
    sky: '#e6eff5',
    fog: '#e6eff5',
    floor: '#f4f9fc',
    border: '#0284c7',
    gridCell: '#cbd5e1',
    gridSection: '#0284c7',
    wallColor: '#1e3a5f',
    wallCap: '#0284c7',
  },
};

function GridObstaclesInstanced({
  gridEnv,
  wallHeight = 0.85,
  palette,
  dynamicObstacleCell = null,
  onObstaclePointerDown = null,
}) {
  const bodyMeshRef = useRef();
  const capMeshRef = useRef();

  const { rows, cols, cellSize = 0.75, blocked = [] } = gridEnv || {};

  const blockedCells = useMemo(() => {
    const list = [];
    if (!rows || !cols || !Array.isArray(blocked)) return list;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (blocked[r * cols + c]) {
          const { x, z } = cellToWorld(r, c, rows, cols, cellSize);
          list.push({ r, c, x, z });
        }
      }
    }
    return list;
  }, [rows, cols, cellSize, blocked]);

  useEffect(() => {
    if (!bodyMeshRef.current || !capMeshRef.current || blockedCells.length === 0) return;

    const dummy = new THREE.Object3D();
    const capDummy = new THREE.Object3D();
    const boxSize = cellSize * 0.92;

    for (let i = 0; i < blockedCells.length; i++) {
      const cell = blockedCells[i];
      dummy.position.set(cell.x, wallHeight / 2, cell.z);
      dummy.scale.set(boxSize, wallHeight, boxSize);
      dummy.updateMatrix();
      bodyMeshRef.current.setMatrixAt(i, dummy.matrix);

      capDummy.position.set(cell.x, wallHeight + 0.015, cell.z);
      capDummy.scale.set(boxSize * 0.96, 0.03, boxSize * 0.96);
      capDummy.updateMatrix();
      capMeshRef.current.setMatrixAt(i, capDummy.matrix);
    }

    bodyMeshRef.current.instanceMatrix.needsUpdate = true;
    capMeshRef.current.instanceMatrix.needsUpdate = true;
  }, [blockedCells, cellSize, wallHeight]);

  const dynWorld = useMemo(() => {
    if (!dynamicObstacleCell || !rows || !cols) return null;
    return cellToWorld(dynamicObstacleCell.row, dynamicObstacleCell.col, rows, cols, cellSize);
  }, [dynamicObstacleCell, rows, cols, cellSize]);

  return (
    <group>
      {blockedCells.length > 0 && (
        <>
          <instancedMesh
            key={`walls-${blockedCells.length}`}
            ref={bodyMeshRef}
            args={[null, null, blockedCells.length]}
            castShadow
            receiveShadow
            frustumCulled={false}
            onPointerDown={(e) => {
              if (!onObstaclePointerDown) return;
              const id = e.instanceId;
              if (id !== undefined && blockedCells[id]) {
                e.stopPropagation();
                onObstaclePointerDown(blockedCells[id].r, blockedCells[id].c);
              }
            }}
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial
              color={palette.wallColor}
              roughness={0.38}
              metalness={0.22}
            />
          </instancedMesh>

          <instancedMesh
            key={`caps-${blockedCells.length}`}
            ref={capMeshRef}
            args={[null, null, blockedCells.length]}
            frustumCulled={false}
          >
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial
              color={palette.wallCap}
              roughness={0.3}
              metalness={0.3}
            />
          </instancedMesh>
        </>
      )}

      {dynWorld && (
        <mesh position={[dynWorld.x, (wallHeight * 1.1) / 2, dynWorld.z]} castShadow>
          <boxGeometry args={[cellSize * 0.9, wallHeight * 1.1, cellSize * 0.9]} />
          <meshStandardMaterial
            color="#dc2626"
            emissive="#f59e0b"
            emissiveIntensity={0.45}
            roughness={0.25}
          />
        </mesh>
      )}
    </group>
  );
}

export function SimulatorScene({
  gridEnv = null,
  environment = { width: 20, depth: 20, resolution: 0.5, obstacles: [], terrainZones: [] },
  robotConfig = { model: 'differential', footprintRadius: 0.32 },
  robotPose = { x: 0, z: 0, theta: 0 },
  startWorld = null,
  goalWorld = null,
  path = [],
  visited = [],
  tree = [],
  algorithm = 'ASTAR',
  wallHeight = 0.85,
  surfaceTheme = 'lemon-ivory',
  activeTool = 'navigate',
  regionStart = null,
  dynamicObstacleCell = null,
  onCellInteract = null,
  onFinishDrag = null,
  toggles = {
    showGrid: true,
    showObstacles: true,
    showPath: true,
    showExplored: true,
    showTree: true,
    showWaypoints: true,
    showAxes: false,
  },
  cameraMode = 'isometric',
  selectedObstacleId = null,
  onSelectObstacle = null,
  canvasRef = null,
}) {
  const palette = SURFACE_PALETTES[surfaceTheme] || SURFACE_PALETTES['lemon-ivory'];
  const [hoveredCell, setHoveredCell] = useState(null);
  const [isPainting, setIsPainting] = useState(false);

  const cellSize = gridEnv?.cellSize || environment?.resolution || 0.75;
  const envWidth = gridEnv ? gridEnv.cols * cellSize : environment?.width || 20;
  const envDepth = gridEnv ? gridEnv.rows * cellSize : environment?.depth || 20;

  const resolvedStart = startWorld || environment?.start || { x: -5, z: -5 };
  const resolvedGoal = goalWorld || environment?.goal || { x: 5, z: 5 };

  const hoveredWorld = useMemo(() => {
    if (!hoveredCell || !gridEnv) return null;
    return cellToWorld(hoveredCell.row, hoveredCell.col, gridEnv.rows, gridEnv.cols, cellSize);
  }, [hoveredCell, gridEnv, cellSize]);

  const regionStartWorld = useMemo(() => {
    if (!regionStart || !gridEnv) return null;
    return cellToWorld(regionStart.row, regionStart.col, gridEnv.rows, gridEnv.cols, cellSize);
  }, [regionStart, gridEnv, cellSize]);

  const handleFloorPointerDown = (e) => {
    if (!gridEnv || !onCellInteract || activeTool === 'navigate') return;
    if (e.button !== 0) return; // Only left click edits
    e.stopPropagation();
    const { row, col } = worldToCell(e.point.x, e.point.z, gridEnv.rows, gridEnv.cols, cellSize);
    setHoveredCell({ row, col });
    if (activeTool === 'draw' || activeTool === 'erase') {
      setIsPainting(true);
    }
    onCellInteract(row, col, true);
  };

  const handleFloorPointerMove = (e) => {
    if (!gridEnv) return;
    const { row, col } = worldToCell(e.point.x, e.point.z, gridEnv.rows, gridEnv.cols, cellSize);
    setHoveredCell((prev) =>
      prev && prev.row === row && prev.col === col ? prev : { row, col }
    );
    if (isPainting && onCellInteract && (activeTool === 'draw' || activeTool === 'erase')) {
      e.stopPropagation();
      onCellInteract(row, col, false);
    }
  };

  const handlePointerUp = () => {
    if (isPainting) {
      setIsPainting(false);
      if (onFinishDrag) onFinishDrag();
    }
  };

  const toolHighlightColor =
    activeTool === 'draw'
      ? '#0d9488'
      : activeTool === 'erase'
      ? '#dc2626'
      : activeTool === 'start'
      ? '#059669'
      : activeTool === 'goal'
      ? '#d97706'
      : '#0284c7';

  return (
    <div
      className="w-full h-full relative overflow-hidden select-none"
      style={{ backgroundColor: palette.sky }}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <Canvas
        ref={canvasRef}
        shadows
        gl={{ preserveDrawingBuffer: true, antialias: true }}
        camera={{ position: [13, 14, 13], fov: 44 }}
        style={{ width: '100%', height: '100%' }}
      >
        {/* Soothing Warm Lemon-Cream / Ivory Studio Backdrop & Subtle Distance Fog */}
        <color attach="background" args={[palette.sky]} />
        <fog attach="fog" args={[palette.fog, 28, 68]} />

        {/* Balanced Daylight Robotics Lab Lighting */}
        <ambientLight intensity={0.85} color="#fffdf5" />
        <directionalLight
          position={[12, 22, 12]}
          intensity={1.25}
          color="#ffffff"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-far={65}
          shadow-camera-left={-18}
          shadow-camera-right={18}
          shadow-camera-top={18}
          shadow-camera-bottom={-18}
          shadow-bias={-0.0005}
        />
        <directionalLight position={[-12, 12, -10]} intensity={0.45} color="#0d9488" />

        {/* Camera Controls (disabled while actively painting cells on 3D floor) */}
        <CameraControls
          cameraMode={cameraMode}
          robotPose={robotPose}
          enabled={!isPainting && activeTool === 'navigate'}
        />

        {/* 3D Arena Floor Base & Interactive Raycast Plane */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.01, 0]}
          receiveShadow
          onPointerDown={handleFloorPointerDown}
          onPointerMove={handleFloorPointerMove}
          onPointerUp={handlePointerUp}
        >
          <planeGeometry args={[envWidth, envDepth]} />
          <meshStandardMaterial color={palette.floor} roughness={0.92} metalness={0.04} />
        </mesh>

        {/* Subtle Arena Platform Base Slab */}
        <mesh position={[0, -0.09, 0]} receiveShadow>
          <boxGeometry args={[envWidth + 0.35, 0.14, envDepth + 0.35]} />
          <meshStandardMaterial color={palette.border} roughness={0.6} metalness={0.15} />
        </mesh>

        {/* 3D Floor Grid Lines */}
        {toggles.showGrid && (
          <Grid
            position={[0, 0.005, 0]}
            args={[envWidth, envDepth]}
            cellSize={cellSize}
            cellThickness={0.65}
            cellColor={palette.gridCell}
            sectionSize={cellSize * 4}
            sectionThickness={1.15}
            sectionColor={palette.gridSection}
            fadeDistance={48}
            fadeStrength={1}
          />
        )}

        {/* Interactive Cell Cursor Indicator on 3D Floor */}
        {gridEnv && hoveredWorld && activeTool !== 'navigate' && (
          <mesh position={[hoveredWorld.x, 0.035, hoveredWorld.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[cellSize * 0.92, cellSize * 0.92]} />
            <meshBasicMaterial
              color={toolHighlightColor}
              transparent
              opacity={0.42}
              side={THREE.DoubleSide}
            />
          </mesh>
        )}

        {/* First corner marker when using Rect Region tool */}
        {gridEnv && regionStartWorld && (
          <mesh
            position={[regionStartWorld.x, 0.25, regionStartWorld.z]}
          >
            <boxGeometry args={[cellSize * 0.85, 0.5, cellSize * 0.85]} />
            <meshBasicMaterial color="#d97706" wireframe />
          </mesh>
        )}

        {/* Spatial Coordinate Axes Helper */}
        {toggles.showAxes && <axesHelper args={[2.5]} position={[0, 0.05, 0]} />}

        {/* Unified Grid 3D Extruded Obstacles */}
        {toggles.showObstacles && gridEnv && (
          <GridObstaclesInstanced
            gridEnv={gridEnv}
            wallHeight={wallHeight}
            palette={palette}
            dynamicObstacleCell={dynamicObstacleCell}
            onObstaclePointerDown={(r, c) => {
              if (activeTool === 'erase' && onCellInteract) {
                setIsPainting(true);
                onCellInteract(r, c, true);
              }
            }}
          />
        )}

        {/* Legacy Continuous Obstacles Fallback */}
        {toggles.showObstacles &&
          !gridEnv &&
          environment.obstacles?.map((obs) => (
            <ObstacleMesh
              key={obs.id || `${obs.x}-${obs.z}`}
              obstacle={obs}
              isSelected={selectedObstacleId === obs.id}
              onSelect={onSelectObstacle}
            />
          ))}

        {/* Weighted Terrain Zones */}
        {!gridEnv &&
          environment.terrainZones?.map((zone) => (
            <TerrainZoneMesh key={zone.id || `${zone.x}-${zone.z}`} zone={zone} />
          ))}

        {/* Explored Nodes / Frontier & RRT Sampling Tree */}
        <ExploredNodesMesh
          visited={visited}
          tree={tree}
          algorithm={algorithm}
          cellSize={cellSize}
          showExplored={toggles.showExplored}
          showTree={toggles.showTree !== false}
        />

        {/* Computed Path & Start/Goal Beacons */}
        <PathMesh
          path={path}
          start={resolvedStart}
          goal={resolvedGoal}
          showPath={toggles.showPath}
          showWaypoints={toggles.showWaypoints}
          pathColor={algorithm.startsWith('RRT') ? '#0284c7' : '#059669'}
        />

        {/* Simulated Mobile Robot */}
        <RobotMesh
          pose={robotPose}
          model={robotConfig?.model || 'differential'}
          radius={Math.min(0.42, cellSize * 0.44)}
          color="#0d9488"
        />
      </Canvas>

      {/* Subtle Bottom-Left Hover Coordinates & Active Mode Pill (non-overlapping) */}
      {gridEnv && (
        <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#fdfaf0]/90 border border-teal-700/25 shadow-sm text-[11px] font-mono text-[#0f1e36]">
          <span className="font-semibold text-teal-700">
            {activeTool === 'navigate'
              ? 'Orbit / Pan Camera Mode'
              : `3D Grid Edit: ${activeTool.toUpperCase()}`}
          </span>
          {hoveredCell && (
            <span className="text-[#52677c] border-l border-teal-700/20 pl-2">
              Cell ({hoveredCell.row}, {hoveredCell.col})
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default SimulatorScene;
