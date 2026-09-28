// 跨端统一图标组件 - 微信小程序平台实现
// 改动说明：weapp WXML 无 svg 模板（控制台报 tmpl_0_svg not found），
//   H5 版 index.tsx 的 lucide-react 内联 SVG 在小程序端整体渲染为空，
//   导致 TabBar/页面图标全部消失、布局塌陷。
// 方案：从 lucide 纯数据包（与 lucide-react 同版本 0.378.0）取图标的
//   SVG 节点数据，拼成 SVG 字符串后以 data URI 交给 <Image> 渲染
//   （小程序 image 组件支持 svg data URI）。color/size 烘焙进 SVG 属性。
//   全量 icons 数据约 97KB，可覆盖所有动态图标名（item.icon 等），
//   无需维护静态白名单。
// 注意：H5 端走同目录 index.tsx，RN 端走 index.rn.tsx，Taro 按平台后缀自动解析

import { Component } from 'react'
import { Text, Image } from '@tarojs/components'
import { icons } from 'lucide'

/** lucide 节点数据：[tag, attrs] 二元组，svg 根节点为 [tag, attrs, children] */
type LucideNode = [string, Record<string, string | number>] & { [2]?: LucideNode[] }

function toPascal(name: string): string {
  // 与 H5 版保持一致：连字符/下划线图标名（trending-up/user_plus）转 PascalCase 查表
  return name.split(/[-_]/).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('')
}

/** 把 lucide 子节点数组序列化为 SVG 标签字符串 */
function nodeToTag(node: LucideNode): string {
  const [tag, attrs] = node
  const attrStr = Object.entries(attrs)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ')
  // lucide 图标全部是自闭合元素（path/circle/line/polyline/rect 等）
  return `<${tag} ${attrStr}/>`
}

/** 按图标名 + 颜色 + 尺寸生成 SVG data URI；找不到图标返回空串 */
function buildDataUri(name: string, size: number, color: string): string {
  const data = (icons as unknown as Record<string, LucideNode>)[toPascal(name)]
  if (!data) return ''
  const [, , children = []] = data
  const inner = children.map(nodeToTag).join('')
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" ` +
    `viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" ` +
    `stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`
  // encodeURIComponent 生成 data URI，免依赖 base64（小程序无 btoa）
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
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
    const src = buildDataUri(name, size, color)
    if (!src) {
      // 找不到图标：渲染空 Text 占位（与 H5 版行为一致）
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
    // <Image> 在 weapp flex 布局中需显式宽高，故把 size 写进 style
    return (
      <Image
        src={src}
        className={className}
        style={{ width: size, height: size, ...style }}
        mode='aspectFit'
        onClick={onClick}
      />
    )
  }
}
