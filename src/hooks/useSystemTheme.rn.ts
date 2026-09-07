// 系统深浅色（RN 端）：用 react-native Appearance 读取并订阅系统主题变化。
// 返回 'light' | 'dark'。供 useTheme 在 mode='system' 时解析实际深浅。
import { useState, useEffect } from 'react'
import { Appearance } from 'react-native'

export function useSystemTheme(): 'light' | 'dark' {
  const [scheme, setScheme] = useState<'light' | 'dark'>(() =>
    Appearance.getColorScheme() === 'dark' ? 'dark' : 'light'
  )
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setScheme(colorScheme === 'dark' ? 'dark' : 'light')
    })
    return () => sub.remove()
  }, [])
  return scheme
}
