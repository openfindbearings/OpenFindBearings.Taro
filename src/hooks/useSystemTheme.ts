// 系统深浅色（H5/小程序端基线）：H5 用 matchMedia 订阅 prefers-color-scheme；
// 小程序暂按浅色（多数小程序不做深色）。API 与 useSystemTheme.rn.ts 一致。
import { useState, useEffect } from 'react'

export function useSystemTheme(): 'light' | 'dark' {
  const [scheme, setScheme] = useState<'light' | 'dark'>('light')
  useEffect(() => {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const update = () => setScheme(mq.matches ? 'dark' : 'light')
      update()
      mq.addEventListener?.('change', update)
      return () => mq.removeEventListener?.('change', update)
    }
    // 小程序等无 matchMedia 环境：保持 light
    return undefined
  }, [])
  return scheme
}
