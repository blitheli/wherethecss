import { useCallback, useEffect, useMemo, useRef } from 'react'

/*
这个文件定义了一个自定义 React Hook：useResource。它的主要作用是管理资源的生命周期，确保资源在组件卸载时被正确释放（dispose），适用于需要手动清理的对象（如WebGL资源、事件监听等）。

核心区别与useMemo：

useMemo只是缓存计算结果，无法自动处理资源释放。
useResource除了缓存资源，还会在组件卸载时自动调用dispose方法，避免内存泄漏。
useResource支持管理多个资源，通过manage函数收集所有需要释放的资源。

详细流程：

managedResourcesRef：用ref存储所有需要释放的资源。
manage函数：收集资源，返回单个或多个资源，供callback使用。
useMemo：和useMemo类似，缓存callback返回的资源。
useEffect：监听resource变化，组件卸载时统一dispose所有资源。
适用场景：需要手动释放的对象（如Three.js材质、纹理、几何体等），比useMemo更适合资源管理。

总结：useResource是useMemo的增强版，专为资源管理和自动释放设计。
*/

interface Resource {
  dispose: () => void
}

type ManageFunction = <T extends Resource, Rest extends readonly Resource[]>(
  resource: T,
  ...resources: Rest
) => Rest['length'] extends 0 ? T : [T, ...Rest]

export function useResource<T extends Resource | Resource[]>(
  callback: (manage: ManageFunction) => T,
  deps: readonly unknown[]
): T {
  const managedResourcesRef = useRef<Resource[]>([])
  const manage = useCallback(
    (resource: Resource, ...resources: readonly Resource[]) => {
      managedResourcesRef.current.push(resource, ...resources)
      return resources.length === 0 ? resource : [resource, ...resources]
    },
    []
  ) as ManageFunction

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const resource = useMemo(() => callback(manage), deps)

  useEffect(() => {
    return () => {
      const resources = [
        ...(Array.isArray(resource) ? resource : [resource]),
        ...managedResourcesRef.current
      ].filter((value, index, array) => array.indexOf(value) === index)
      managedResourcesRef.current = []

      for (const resource of resources) {
        resource.dispose()
      }
    }
  }, [resource])

  return resource
}
