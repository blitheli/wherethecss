import { useState, useEffect, useMemo } from 'react'
import '../App.css'

export default function About() {
  const [count, setCount] = useState(0)
  const [inputValue, setInputValue] = useState('')
  const [items, setItems] = useState<number[]>([])
  const [filterThreshold, setFilterThreshold] = useState(50)

  // useEffect 示例1: 组件挂载时执行，模拟数据加载
  useEffect(() => {
    console.log('组件挂载了！')
    
    // 模拟从 API 加载初始数据
    const loadInitialData = () => {
      const mockData = Array.from({ length: 100 }, (_, i) => Math.floor(Math.random() * 100))
      setItems(mockData)
    }
    
    loadInitialData()
    
    // 清理函数：组件卸载时执行
    return () => {
      console.log('组件即将卸载！')
    }
  }, []) // 空依赖数组 = 只在挂载时执行一次

  // useEffect 示例2: 监听 count 变化
  useEffect(() => {
    console.log(`count 改变了，新值: ${count}`)
    
    // 当 count 达到 10 时显示提示
    if (count === 10) {
      alert('恭喜！你点击了 10 次！')
    }
  }, [count]) // 依赖 count，每次 count 变化时执行

  // useEffect 示例3: 监听多个依赖项
  useEffect(() => {
    document.title = `Count: ${count} | Filter: ${filterThreshold}`
    
    return () => {
      document.title = 'React App' // 恢复默认标题
    }
  }, [count, filterThreshold]) // 依赖多个值

  // useMemo 示例1: 昂贵的过滤计算
  // 只有当 items 或 filterThreshold 改变时才重新计算
  const filteredItems = useMemo(() => {
    console.log('🔄 重新计算 filteredItems...')
    
    // 模拟一个昂贵的计算过程
    return items.filter(item => item > filterThreshold)
  }, [items, filterThreshold])

  // useMemo 示例2: 复杂的统计计算
  const statistics = useMemo(() => {
    console.log('📊 重新计算统计数据...')
    
    if (items.length === 0) {
      return { sum: 0, average: 0, max: 0, min: 0 }
    }
    
    const sum = items.reduce((acc, val) => acc + val, 0)
    const average = sum / items.length
    const max = Math.max(...items)
    const min = Math.min(...items)
    
    return { sum, average, max, min }
  }, [items])

  // useMemo 示例3: 根据输入值进行搜索过滤
  const searchResults = useMemo(() => {
    console.log('🔍 重新搜索...')
    
    if (!inputValue) return items
    
    const threshold = parseInt(inputValue)
    if (isNaN(threshold)) return items
    
    return items.filter(item => item.toString().includes(inputValue))
  }, [items, inputValue])

  // 普通函数（对比用）- 每次渲染都会重新创建
  const normalCalculation = () => {
    console.log('⚠️ 普通函数每次渲染都执行')
    return items.length * 2
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>useEffect 和 useMemo 演示</h1>
      
      {/* useEffect 示例区域 */}
      <section style={{ marginBottom: '30px', padding: '15px', border: '2px solid #61dafb', borderRadius: '8px' }}>
        <h2>🔄 useEffect 示例</h2>
        <p>打开控制台查看 useEffect 的执行日志</p>
        
        <div style={{ marginBottom: '10px' }}>
          <button onClick={() => setCount(count + 1)}>
            点击次数: {count}
          </button>
          <button onClick={() => setCount(0)} style={{ marginLeft: '10px' }}>
            重置
          </button>
        </div>
        
        <p style={{ fontSize: '14px', color: '#666' }}>
          💡 每次点击按钮，count 改变时 useEffect 会执行
        </p>
      </section>

      {/* useMemo 示例区域 */}
      <section style={{ marginBottom: '30px', padding: '15px', border: '2px solid #9945ff', borderRadius: '8px' }}>
        <h2>⚡ useMemo 示例</h2>
        
        <div style={{ marginBottom: '15px' }}>
          <label>
            过滤阈值: {filterThreshold}
            <input
              type="range"
              min="0"
              max="100"
              value={filterThreshold}
              onChange={(e) => setFilterThreshold(Number(e.target.value))}
              style={{ marginLeft: '10px', width: '200px' }}
            />
          </label>
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label>
            搜索数字:
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="输入数字搜索"
              style={{ marginLeft: '10px', padding: '5px' }}
            />
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
          <div style={{ background: '#f0f0f0', padding: '10px', borderRadius: '5px' }}>
            <h3>📊 统计数据 (useMemo)</h3>
            <p>总数: {items.length}</p>
            <p>总和: {statistics.sum.toFixed(0)}</p>
            <p>平均值: {statistics.average.toFixed(2)}</p>
            <p>最大值: {statistics.max}</p>
            <p>最小值: {statistics.min}</p>
          </div>
          
          <div style={{ background: '#f0f0f0', padding: '10px', borderRadius: '5px' }}>
            <h3>🔍 过滤结果 (useMemo)</h3>
            <p>大于 {filterThreshold} 的数字: {filteredItems.length} 个</p>
            <p>搜索结果: {searchResults.length} 个</p>
            <p>普通计算结果: {normalCalculation()}</p>
          </div>
        </div>
        
        <p style={{ fontSize: '14px', color: '#666', marginTop: '10px' }}>
          💡 打开控制台，修改 count 不会触发 useMemo 重新计算，只有修改阈值或搜索才会重新计算
        </p>
      </section>

      {/* 数据展示 */}
      <section style={{ padding: '15px', border: '2px solid #14f195', borderRadius: '8px' }}>
        <h2>📦 数据展示</h2>
        <div style={{ maxHeight: '200px', overflow: 'auto', background: '#f9f9f9', padding: '10px', borderRadius: '5px' }}>
          <p><strong>过滤后的数据 (前20个):</strong></p>
          <p>{filteredItems.slice(0, 20).join(', ')}</p>
        </div>
        
        <button 
          onClick={() => setItems(Array.from({ length: 100 }, () => Math.floor(Math.random() * 100)))}
          style={{ marginTop: '10px' }}
        >
          🔄 重新生成随机数据
        </button>
      </section>

      {/* 说明文档 */}
      <section style={{ marginTop: '30px', padding: '15px', background: '#f5f5f5', borderRadius: '8px' }}>
        <h3>📚 知识点总结</h3>
        <ul style={{ textAlign: 'left', lineHeight: '1.8' }}>
          <li><strong>useEffect</strong>: 处理副作用（数据获取、订阅、DOM 操作等）</li>
          <li><strong>useEffect 依赖数组</strong>: [] 只执行一次，[dep] 依赖变化时执行</li>
          <li><strong>useEffect 清理函数</strong>: return 的函数在组件卸载或下次执行前调用</li>
          <li><strong>useMemo</strong>: 缓存计算结果，避免重复昂贵的计算</li>
          <li><strong>useMemo 依赖数组</strong>: 只有依赖项改变时才重新计算</li>
          <li><strong>性能优化</strong>: 对比普通函数，useMemo 可以显著减少不必要的计算</li>
        </ul>
      </section>
    </div>
  )
}
