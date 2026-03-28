import React, { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { GlobeControls, TilesRenderer } from "3d-tiles-renderer";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

/** 默认相对偏移必须用稳定引用；否则父组件任意重渲染（如 leva 改 hour）都会 new 出新 Vector3，触发 useEffect 误判为「参数变化」并重置局部相机。 */
const DEFAULT_INIT_RELATIVE_POSITION = new THREE.Vector3(200, 0, 0);

/*
  2026-03-24 blitheli
  
  相机控制器，用于控制相机在 globe 模式和 local 模式下的移动和旋转
  globe 模式下，使用 GlobeControls 控制相机在地球表面上的移动和旋转
  local 模式下，使用 OrbitControls 控制相机在飞行器周围的移动和旋转
*/
interface CameraControllerProps {
  tilesRenderer: TilesRenderer | null;
  scRef: React.RefObject<THREE.Object3D | null>;
  mode: "globe" | "local";
  initRelativePosition?: THREE.Vector3;
  /** 与 WebGPUCanvas / GlobeCamera 中 camera 的裁剪面一致；GlobeControls 会改写 near/far，切回局部时必须恢复 */
  localNear?: number;
  localFar?: number;
}

export const CameraController: React.FC<CameraControllerProps> = ({
  tilesRenderer,
  scRef: aircraftRef,
  mode,
  initRelativePosition = DEFAULT_INIT_RELATIVE_POSITION,
  localNear = 0.1,
  localFar = 1e9,
}) => {
  const { camera, gl, scene } = useThree();
  const orbitRef = useRef<OrbitControlsImpl | null>(null);
  const pendingLocalResetRef = useRef(false);

  // 1. 初始化 GlobeControls (仅在 globe 模式下激活逻辑)
  const globeControls = useMemo(() => {
    const ctrl = new GlobeControls(scene, camera, gl.domElement);
    if (tilesRenderer) ctrl.setTilesRenderer(tilesRenderer);
    return ctrl;
  }, [tilesRenderer, scene, camera, gl]);

  // 2. 模式切换时，显式启停 controls 并重置相机
  useEffect(() => {
    globeControls.enabled = mode === "globe";

    if (mode === "local") {
      // OrbitControls 在该模式下是条件渲染，切换当帧可能还未挂载。
      // 延后到 useFrame 中等待 controls 就绪后再重置相机。
      pendingLocalResetRef.current = true;
      return;
    }

    if (mode === "globe") {
      camera.position.set(0, -2e7, 0);
      camera.up.set(0, 0, 1);
      camera.lookAt(0, 0, 0);
      globeControls.update();
    }
  }, [mode, globeControls, camera, aircraftRef, initRelativePosition]);

  // 3. 核心逻辑循环
  useFrame(() => {
    if (mode === "globe" && globeControls.enabled) {
      globeControls.update();
    } else if (mode === "local" && aircraftRef.current && orbitRef.current) {
      // 获取飞行器的世界坐标 (ECEF)
      const worldPos = new THREE.Vector3();
      aircraftRef.current.getWorldPosition(worldPos);

      if (pendingLocalResetRef.current) {
        camera.position.copy(worldPos).add(initRelativePosition);
        camera.lookAt(worldPos);
        camera.up.copy(worldPos.clone().normalize());
        // GlobeControls.adjustCamera() 在全球模式下会改写 near/far；禁用后不会自动恢复，
        // 若仍保留巨大 near，局部场景会被全部裁掉，表现为「切回局部一片黑」。
        if (camera instanceof THREE.PerspectiveCamera) {
          camera.near = localNear;
          camera.far = localFar;
          camera.updateProjectionMatrix();
        }
        orbitRef.current.target.copy(worldPos);
        orbitRef.current.update();
        pendingLocalResetRef.current = false;
      }

      // 将 OrbitControls 的旋转中心锁定在飞行器上
      orbitRef.current.target.copy(worldPos);

      // 重要：更新相机的 Up 向量为该点的地表法线
      // 否则在地球侧面观察时，地平线会是歪的
      const normal = worldPos.clone().normalize();
      camera.up.lerp(normal, 0.1);

      orbitRef.current.update();
    }
  });

  // 4. 销毁
  React.useEffect(() => {
    return () => globeControls.dispose();
  }, [globeControls]);

  return (
    <>
      {mode === "local" && (
        <OrbitControls
          ref={orbitRef}
          enableDamping
          // 防止缩放穿透地球表面（可选）
          minDistance={0.1}
          maxDistance={5000000}
        />
      )}
    </>
  );
};
