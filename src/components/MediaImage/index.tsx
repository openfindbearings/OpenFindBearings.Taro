// 跨端媒体图片组件：统一经 usableImage 解析库内媒体地址，并在"无地址/加载失败"时回退占位图标。
// 改动说明：各列表页此前裸写 `usableImage(x) ? <Image/> : <Icon/>`，但缺 onError 兜底——
// 图片解析出地址却加载 404 时渲染为空白（首页搜索结果轴承图即此症状）。收敛到本组件，
// 空地址与加载失败统一降级为占位图标，跨端（H5/RN/小程序）行为一致。
import { Component, ReactNode } from 'react'
import { Image } from '@tarojs/components'
import { usableImage } from '../../services/config'
import Icon from '../Icon'

interface MediaImageProps {
  /** 库内媒体地址：相对键 /images、/uploads、/avatars，或绝对 http(s)，或预置键 */
  url?: string | null
  /** 无地址或加载失败时回退的 lucide 图标名 */
  fallbackIcon?: string
  /** 回退图标颜色 */
  fallbackColor?: string
  /** 回退图标尺寸 */
  fallbackSize?: number
  /** 自定义占位节点：传入则取代默认回退图标（保留各页原有占位框样式） */
  fallback?: ReactNode
  /** 图片容器样式类（与原 <Image> 的 className 一致） */
  className?: string
  /** 图片/占位共用尺寸等内联样式 */
  style?: any
  /** Taro Image 裁剪模式 */
  mode?: 'scaleToFill' | 'aspectFit' | 'aspectFill' | 'widthFix' | 'heightFix' | string
}

interface MediaImageState {
  failed: boolean
}

export default class MediaImage extends Component<MediaImageProps, MediaImageState> {
  state: MediaImageState = { failed: false }

  // url 变化（列表项复用、切换商户/条目）时清空失败标记，避免上一条的失败态残留到新图
  componentDidUpdate(prev: MediaImageProps) {
    if (prev.url !== this.props.url && this.state.failed) {
      this.setState({ failed: false })
    }
  }

  render() {
    const {
      url,
      fallbackIcon = 'image',
      fallbackColor = '#94A3B8',
      fallbackSize = 22,
      fallback,
      className,
      style,
      mode = 'aspectFill'
    } = this.props
    const src = usableImage(url)
    if (!src || this.state.failed) {
      if (fallback !== undefined) return fallback
      return <Icon name={fallbackIcon} size={fallbackSize} color={fallbackColor} />
    }
    return (
      <Image
        className={className}
        style={style}
        src={src}
        mode={mode as any}
        onError={() => this.setState({ failed: true })}
      />
    )
  }
}
