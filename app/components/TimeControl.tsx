/**
 * 时间控制组件
 *
 * 功能:
 * - 实时/仿真模式切换
 * - 时间进度条显示和控制
 * - 仿真模式下支持加速/减速（类似Cesium Timeline）
 *
 * @author blitheli 20260331
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Slider, Switch, Button, Space, Typography } from 'antd'
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  FastForwardOutlined,
  BackwardOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'

const { Text } = Typography

export interface TimeControlProps {
  /** 当前时间（受控） */
  currentTime: Date
  /** 时间变化回调 */
  onTimeChange: (date: Date) => void
  /** 是否实时模式 */
  isRealtime: boolean
  /** 实时模式切换回调 */
  onRealtimeChange: (isRealtime: boolean) => void
  /** 仿真时间倍速（1 = 1秒现实时间=1秒模拟时间） */
  simulationSpeed: number
  /** 仿真倍速变化回调 */
  onSpeedChange: (speed: number) => void
  /** 仿真模式是否暂停 */
  isPaused: boolean
  /** 暂停状态切换回调 */
  onPauseChange: (isPaused: boolean) => void
}

export function TimeControl({
  currentTime,
  onTimeChange,
  isRealtime,
  onRealtimeChange,
  simulationSpeed,
  onSpeedChange,
  isPaused,
  onPauseChange,
}: TimeControlProps) {
  const [sliderValue, setSliderValue] = useState(0)
  const animationFrameRef = useRef<number>()
  const lastUpdateTimeRef = useRef<number>(Date.now())
  const startTimeRef = useRef<number>(Date.now())
  const currentTimeRef = useRef(currentTime.getTime())

  // 同步外部currentTime到ref
  useEffect(() => {
    currentTimeRef.current = currentTime.getTime()
  }, [currentTime])

  // 将Date转换为进度条值（0-1000，基于一天）
  const dateToSliderValue = (date: Date): number => {
    const hours = date.getHours()
    const minutes = date.getMinutes()
    const seconds = date.getSeconds()
    const milliseconds = date.getMilliseconds()
    const totalSeconds = hours * 3600 + minutes * 60 + seconds + milliseconds / 1000
    return (totalSeconds / 86400) * 1000
  }

  // 将进度条值转换为Date（保持当前日期的年月日）
  const sliderValueToDate = (value: number): Date => {
    const newDate = new Date(currentTime)
    const totalSeconds = (value / 1000) * 86400
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = Math.floor(totalSeconds % 60)
    const milliseconds = Math.round((totalSeconds % 1) * 1000)
    newDate.setHours(hours, minutes, seconds, milliseconds)
    return newDate
  }

  // 实时模式：每一帧同步为当前系统时间
  useEffect(() => {
    if (isRealtime) {
      const updateRealtime = () => {
        const now = new Date()
        onTimeChange(now)
        setSliderValue(dateToSliderValue(now))
        animationFrameRef.current = requestAnimationFrame(updateRealtime)
      }
      updateRealtime()
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isRealtime])

  // 仿真模式：根据倍速更新时间
  useEffect(() => {
    if (!isRealtime && !isPaused) {
      const updateSimulation = () => {
        const now = Date.now()
        const elapsed = (now - lastUpdateTimeRef.current) / 1000 // 秒
        const simulatedElapsed = elapsed * simulationSpeed

        if (simulatedElapsed > 0) {
          currentTimeRef.current += simulatedElapsed * 1000
          const newDate = new Date(currentTimeRef.current)
          onTimeChange(newDate)
          setSliderValue(dateToSliderValue(newDate))
        }

        lastUpdateTimeRef.current = now
        animationFrameRef.current = requestAnimationFrame(updateSimulation)
      }
      updateSimulation()
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isRealtime, isPaused, simulationSpeed, onTimeChange])

  // 当外部currentTime变化时（非实时模式下），更新进度条
  useEffect(() => {
    if (!isRealtime) {
      setSliderValue(dateToSliderValue(currentTime))
    }
  }, [currentTime, isRealtime])

  const handleSliderChange = useCallback((value: number) => {
    setSliderValue(value)
    const newDate = sliderValueToDate(value)
    onTimeChange(newDate)
    if (!isRealtime) {
      lastUpdateTimeRef.current = Date.now()
    }
  }, [currentTime, onTimeChange, isRealtime])

  const speedOptions = [1, 10, 60, 300, 900, 3600] // 1x, 10x, 1min, 5min, 15min, 1hour per second

  const sliderTooltipFormatter = (value: number | undefined) => {
    if (value === undefined) return '';
    const date = sliderValueToDate(value);
    return date.toLocaleTimeString('zh-CN');
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(0, 0, 0, 0.8)',
      padding: '16px 24px',
      borderRadius: '12px',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      zIndex: 1000,
      minWidth: '400px'
    }}>
      <div style={{ marginBottom: 12 }}>
        <Space size="large">
          <ClockCircleOutlined style={{ color: '#1890ff' }} />
          <Text style={{ color: '#fff', fontSize: 14 }}>
            {currentTime.toLocaleTimeString('zh-CN', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              fractionalSecondDigits: 2
            })}
          </Text>
          <Switch
            checkedChildren="实时"
            unCheckedChildren="仿真"
            checked={isRealtime}
            onChange={(checked) => {
              onRealtimeChange(checked)
              if (!checked) {
                // 切换到仿真模式时，重置计时
                lastUpdateTimeRef.current = Date.now()
              }
            }}
          />
        </Space>
      </div>

      {/* 进度条 */}
      <Slider
        min={0}
        max={1000}
        value={sliderValue}
        onChange={handleSliderChange}
        tooltip={{ formatter: sliderTooltipFormatter }}
        style={{ marginBottom: 16 }}
      />

      {/* 仿真控制 */}
      {!isRealtime && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Space>
            <Button
              type="primary"
              icon={isPaused ? <PlayCircleOutlined /> : <PauseCircleOutlined />}
              onClick={() => onPauseChange(!isPaused)}
            >
              {isPaused ? '继续' : '暂停'}
            </Button>
            <Button
              icon={<BackwardOutlined />}
              onClick={() => {
                const currentIndex = speedOptions.indexOf(simulationSpeed)
                if (currentIndex > 0) {
                  onSpeedChange(speedOptions[currentIndex - 1])
                }
              }}
              disabled={speedOptions.indexOf(simulationSpeed) === 0}
            >
              减速
            </Button>
            <Button
              icon={<FastForwardOutlined />}
              onClick={() => {
                const currentIndex = speedOptions.indexOf(simulationSpeed)
                if (currentIndex < speedOptions.length - 1) {
                  onSpeedChange(speedOptions[currentIndex + 1])
                }
              }}
              disabled={speedOptions.indexOf(simulationSpeed) === speedOptions.length - 1}
            >
              加速
            </Button>
          </Space>
          <Text style={{ color: '#fff', fontSize: 12 }}>
            倍速: {simulationSpeed}x
            {simulationSpeed >= 60 && ` (${(simulationSpeed / 60).toFixed(1)}分/秒)`}
          </Text>
        </div>
      )}
    </div>
  )
}
