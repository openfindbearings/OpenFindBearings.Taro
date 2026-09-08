import { View } from '@tarojs/components'
import type { CSSProperties } from 'react'
import type { GradientProps } from './types'

// 改动说明：H5/小程序端用 CSS linear-gradient 实现渐变。react-native-linear-gradient 是 RN 原生模块，
// 其源码含 TS 语法（import { type Props }）且不过 babel，被 H5 webpack 直接打包会报
// ModuleParseError: Unexpected token；故按平台拆分组件——H5/小程序走本文件，RN 走 index.rn.tsx。
export default function Gradient({
  colors,
  start = { x: 0, y: 0 },
  end = { x: 1, y: 0 },
  className,
  style,
  children
}: GradientProps) {
  // RN 的 start/end 方向坐标换算为 CSS 渐变角度（0deg 向上，顺时针）
  const dx = end.x - start.x
  const dy = end.y - start.y
  const deg = ((((Math.atan2(dx, -dy) * 180) / Math.PI) % 360) + 360) % 360

  // 过滤 RN 专有样式键（shadow*/elevation），避免 H5 端 style 含非法值
  const webStyle: Record<string, unknown> = { ...(style || {}) }
  delete webStyle.shadowColor
  delete webStyle.shadowOffset
  delete webStyle.shadowRadius
  delete webStyle.shadowOpacity
  delete webStyle.elevation
  webStyle.backgroundImage = `linear-gradient(${deg}deg, ${colors.join(', ')})`

  return (
    <View className={className} style={webStyle as CSSProperties}>
      {children}
    </View>
  )
}
