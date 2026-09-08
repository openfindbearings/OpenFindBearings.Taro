import type { CSSProperties, ReactNode } from 'react'

// 渐变组件公共属性：colors 为色标数组，start/end 为 RN 风格的 0~1 方向坐标。
// 单独放无平台后缀文件，供 index.tsx(H5/小程序) 与 index.rn.tsx(RN) 共同引用，
// 避免 .rn 解析时从 './index' 引回自身造成循环。
export interface GradientProps {
  colors: string[]
  start?: { x: number; y: number }
  end?: { x: number; y: number }
  className?: string
  style?: CSSProperties
  children?: ReactNode
}
