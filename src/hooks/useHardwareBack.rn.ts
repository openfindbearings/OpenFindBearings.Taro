// 系统返回键拦截（RN 端）：用 react-native BackHandler 订阅 hardwareBackPress。
// 传入的 handler 返回 true 表示本次返回已被业务消费（阻止页面被 React Navigation 直接 pop），
// 返回 false 则交还系统默认返回（退出当前页）。用于多步向导逐级回退而非一步退到上级页。
import { useEffect, useRef } from 'react'
import { BackHandler } from 'react-native'

export function useHardwareBack(handler: () => boolean): void {
  // 用 ref 保存最新 handler，订阅只在挂载时建立一次，避免闭包捕获过期的相位状态
  const handlerRef = useRef(handler)
  handlerRef.current = handler
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => handlerRef.current())
    return () => sub.remove()
  }, [])
}
