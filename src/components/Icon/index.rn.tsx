// 跨端统一图标组件 - RN 平台实现
// RN 端：lucide-react-native 通过 react-native-svg 渲染（与 H5 的 lucide-react API 一致）
// 注意：H5 / 小程序使用同目录 index.tsx（lucide-react web SVG）
// 改动说明：原单文件用 #ifdef 条件编译 import 两个 lucide 包，但 RN Metro 不识别 #ifdef、
// H5 webpack 会静态打包全部 import 导致 react-native 进入 H5 bundle 崩溃；
// 改为平台后缀文件（index.rn.tsx / index.tsx）彻底隔离两端依赖

import { Component } from 'react'
import { Text } from '@tarojs/components'
import * as Lucide from 'lucide-react-native'

function toPascal(name: string): string {
  return name.split('_').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('')
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
      return <Comp size={size} color={color} style={style} />
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
