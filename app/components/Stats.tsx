import { addAfterEffect, useThree } from '@react-three/fiber'
import { useEffect, type FC } from 'react'
import StatsImpl from 'stats-gl'

/*
  将StatsGl组件渲染到Canvas容器中，而不是document.body中。
  暂时 trackGPU 为 false，避免 WebGPU timestamp 查询问题
  20260321  blitheli
*/

export interface StatsProps {
  show?: boolean
}

export const Stats: FC<StatsProps> = ({ show = false }) => {
  const gl = useThree((state) => state.gl)

  useEffect(() => {
    if (!show) {
      return
    }

    // 检测是否为 WebGPU 渲染器
    const isWebGPU = (gl as any).isWebGPURenderer === true

    const stats = new StatsImpl({
      trackGPU: false,  // 暂时禁用 GPU 追踪以避免 WebGPU timestamp 查询问题
      trackCPU: true,
      horizontal: false
    })

    stats
      .init(gl)
      .then(() => {
        addAfterEffect(() => {
          stats.update()
        })
      })
      .catch((error: unknown) => {
        console.error('Stats initialization error:', error)
      })

    // 获取 Canvas 的 DOM 容器
    const canvasElement = gl.domElement
    const canvasContainer = canvasElement.parentElement

    if (canvasContainer) {
      // 确保容器为相对定位
      canvasContainer.style.position = 'relative'
      
      // 将 stats 面板附加到 Canvas 容器而不是 document.body
      canvasContainer.appendChild(stats.dom)
      
      // 设置 stats 面板的样式，确保显示在左上角
      stats.dom.style.position = 'absolute'
      stats.dom.style.top = '0'
      stats.dom.style.left = '0'
      stats.dom.style.zIndex = '9999'
      stats.dom.style.display = 'block'
      stats.dom.style.visibility = 'visible'
      stats.dom.style.opacity = '1'
    }

    return () => {
      // 清理时从容器移除
      if (canvasContainer && canvasContainer.contains(stats.dom)) {
        canvasContainer.removeChild(stats.dom)
      }
    }
  }, [show, gl])

  return null
}
