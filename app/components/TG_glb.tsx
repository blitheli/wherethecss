import { useMemo, type ComponentProps, type FC } from 'react'
import { Matrix3, Vector3, type Matrix4, type Object3D } from 'three'

import { lerp } from '@takram/three-geospatial'
import { useGLTF } from '../hooks/useGLTF'
import { useGuardedFrame } from '../hooks/useGuardedFrame'

/**
  天宫glb模型, 包含太阳翼的实时旋转角度计算,指向太阳方向

  太阳方向是在模型的scene根节点坐标系下计算的，因此无论scene根节点怎么旋转，只影响scene.matrixWorld，而不会影响模型本身的坐标系。

  注意: 在Three.js Edit中，可查看scene根节点坐标系和各太阳帆板的旋转轴关系(Blender中查看+Z是向上的,在Three.js Edit中查看+Y是向上的)

  天宫模型的scene根节点坐标系(Three.js中)为：
    +x 指向梦天方向
    +y 向上
    +z 指向飞行方向(天和反方向)

  天和太阳翼: 零位时，帆板法线指向 +y方向
    beta角: 绕-X转动

  梦天太阳翼: 零位时，帆板法线指向 +y方向
    alpha角: 绕-X转动
    beta角:  绕+Z转动

  若模型更改,注意scene节点下的坐标系是否改变！！

  20260330 blitheli
 */
const vector = new Vector3()
const rotation = new Matrix3()

/** 在 rootName 子树内找 childName；WTTYY/MTTYY 挂在 TGWT/TGMT 下。找不到子节点则退回父节点（铰链在父级时）。 */
function wingPanelTarget(
  scene: Object3D,
  rootName: string,
  childName: string,
): Object3D | null {
  const root = scene.getObjectByName(rootName)
  if (root == null) return null
  const child = root.getObjectByName(childName)
  return child ?? root
}

export interface TiangongProps extends ComponentProps<'group'> {
  matrixWorldToECEF: Matrix4
  sunDirectionECEF: Vector3
}

/** 天宫 GLB 两侧太阳翼：WTTYY 在 TGWT 下、MTTYY 在 TGMT 下；对日旋转作用在子节点（无子则作用在父）。 */
export const TG_glb: FC<TiangongProps> = ({
  matrixWorldToECEF,
  sunDirectionECEF,
  ...props
}) => {
  const gltf = useGLTF('/models/tg_simple.glb')

  const userData: {
    initialized?: boolean
  } = gltf.userData

  if (userData.initialized !== true) {
    userData.initialized = true
    Object.values(gltf.meshes).forEach(mesh => {
      mesh.receiveShadow = true
      mesh.castShadow = true
    })
  }

  const { panelTH, panelsSYCT} = useMemo(() => {
    const scene = gltf.scene
    const th = scene.getObjectByName('THTYY')
    const wt = scene.getObjectByName('WTTYY')
    const mt = scene.getObjectByName('MTTYY')
    return {
      panelTH: th != null ? [th] : [],
      panelsSYCT: wt != null ? [wt, mt] : []
    }
  }, [gltf.scene])

  useGuardedFrame(() => {
    if (panelTH.length === 0 && panelsSYCT.length === 0) return

    // 太阳方向在scene根节点坐标系下
    const sunDirectionLocal = vector
      .copy(sunDirectionECEF)
      .applyMatrix3(rotation.setFromMatrix4(matrixWorldToECEF).transpose())
      .normalize()
      .applyMatrix3(rotation.setFromMatrix4(gltf.scene.matrixWorld).transpose())
      .normalize()

    const { x, y, z } = sunDirectionLocal
    // 绕+X轴旋转的角度, +Y为零点,
    // 注意此角度和天和太阳翼的beta角度相反，也和梦天太阳翼的alpha角度相反
    const rotX = Math.atan2(z, y)

    // 绕+Z轴旋转的角度, YZ平面为零点(与YZ平面的夹角)
    // 作为梦天和问天的beta角
    const rotZ = Math.asin(-x)

    const alpha = 0.05
    // 天和太阳翼(beta角)
    for (const p of panelTH) {
      p.rotation.x = lerp(p.rotation.x, rotX, alpha)
    }

    for (const p of panelsSYCT) {
      if (p == null) continue
      p.rotation.x =  lerp(p.rotation.x, rotX, alpha)
      p.rotation.z = lerp(p.rotation.z, rotZ, alpha)
    }
  })

  return (
    <group {...props}  rotation-z={0} >
      <primitive object={gltf.scene}/>
    </group>
  )
}
