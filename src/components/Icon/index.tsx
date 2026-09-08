// 跨端统一图标组件 - H5 / 小程序平台实现
// - H5 端：lucide-react 渲染 web SVG
// - 小程序端：暂用 lucide-react（后续可换 lucide-react-taro）
// 注意：RN 端使用同目录 index.rn.tsx（lucide-react-native 通过 react-native-svg 渲染）
// 改动说明：原单文件用 #ifdef 条件编译 import 两个 lucide 包，但 H5 webpack 会静态打包
// 全部 import 导致 react-native 进入 H5 bundle 崩溃；改为平台后缀文件彻底隔离

import { Component } from 'react'
import { Text } from '@tarojs/components'
import * as Lucide from 'lucide-react'

function toPascal(name: string): string {
  // 改动说明：原只按 '_' 分割，导致连字符图标名（trending-up/user-plus/badge-check）解析不到
  // Lucide 导出（TrendingUp/UserPlus/BadgeCheck）。改为同时按 '-' 与 '_' 分割。
  return name.split(/[-_]/).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('')
}

interface IconProps {
  name: string
  size?: number
  color?: string
  className?: string
  style?: any
  onClick?: () => void
}

export default class Icon extends Component<IconProps> {
  render() {
    const { name, size = 20, color = '#0F172A', className, style, onClick } = this.props
    const pascalName = toPascal(name)
    const Comp: any = (Lucide as any)[pascalName]
    if (Comp) {
      return <Comp size={size} color={color} className={className} style={style} onClick={onClick} />
    }
    // 找不到图标：渲染空 Text 占位（保持视觉一致）
    return (
      <Text
        className={className}
        style={{ fontSize: typeof size === 'number' ? size : 20, color, ...style }}
        onClick={onClick}
      >
        {''}
      </Text>
    )
  }
}
