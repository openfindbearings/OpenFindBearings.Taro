// 跨端媒体图片组件：统一经 usableImage 解析库内媒体地址，并在"无地址/加载失败"时回退占位图标。
// 改动说明：各列表页此前裸写 `usableImage(x) ? <Image/> : <Icon/>`，但缺 onError 兜底——
// 图片解析出地址却加载 404 时渲染为空白（首页搜索结果轴承图即此症状）。收敛到本组件，
// 空地址与加载失败统一降级为占位图标，跨端（H5/RN/小程序）行为一致。
import { Component, ReactNode } from 'react'
import { Image, View } from '@tarojs/components'
import { usableImage } from '../../services/config'
import Icon from '../Icon'

interface MediaImageProps {
  /** 首选库内媒体地址：相对键 /images、/uploads、/avatars，或绝对 http(s)，或预置键 */
  url?: string | null
  /** 备选地址链：主 url 加载失败（404 等）时按序降级，全部失败才显示占位 */
  fallbacks?: (string | null | undefined)[]
  /** 无地址或全部候选加载失败时回退的 lucide 图标名 */
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
  // 当前尝试到的候选下标；超过候选链长度即"全部失败"，显示占位层
  idx: number
}

// 无候选/隐藏图片层时使用的 1x1 透明 GIF（data URI 三端皆可解析、必不触发 onError）
const EMPTY_SRC = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

export default class MediaImage extends Component<MediaImageProps, MediaImageState> {
  state: MediaImageState = { idx: 0 }

  // 主/备地址变化（列表项复用、切换条目）时重置到候选链首，避免上一条的失败下标残留
  componentDidUpdate(prev: MediaImageProps) {
    const key = (p: MediaImageProps) => `${p.url ?? ''}|${(p.fallbacks ?? []).join(',')}`
    if (key(prev) !== key(this.props) && this.state.idx !== 0) {
      this.setState({ idx: 0 })
    }
  }

  render() {
    const {
      url,
      fallbacks,
      fallbackIcon = 'image',
      fallbackColor = '#94A3B8',
      fallbackSize = 22,
      fallback,
      className,
      style,
      mode = 'aspectFill'
    } = this.props
    // 候选链：[主, ...备] 经 usableImage 解析后滤空并去重（保序），详情/列表传入重复值时不会重复请求
    const raw = [url, ...(fallbacks ?? [])]
    const seen = new Set<string>()
    const candidates: string[] = []
    for (const u of raw) {
      const s = usableImage(u)
      if (s && !seen.has(s)) {
        seen.add(s)
        candidates.push(s)
      }
    }
    const src = candidates[this.state.idx]
    const showImg = !!src
    // 改动说明（RN 崩溃根治 v3）：原"有图渲染 Image、无图/全失败切换占位子树"的条件渲染，
    // 在列表成批图片异步失败时产生 Image↔占位 子树挂载/卸载的结构 ops（manageChildren），
    // 与页面大列表首挂/切页卸载的 UI 队列打架，RN legacy 确定性崩溃
    // （IllegalViewOperationException: ViewManager for tag could not be found，收藏/寻货页复现）。
    // 改为图片层与占位层双常驻 + display 切换：显隐只产生样式 props，零结构 ops。
    // 尺寸语义保持：className/style 移到外层容器（内层两分支均铺满），overflow hidden 保圆角裁切。
    return (
      <View className={className} style={{ overflow: 'hidden', ...(style || {}) }}>
        <View style={{ width: '100%', height: '100%', display: showImg ? 'flex' : 'none' }}>
          <Image
            src={src || EMPTY_SRC}
            style={{ width: '100%', height: '100%' }}
            mode={mode as any}
            // 加载失败自动前进到下一个候选，候选耗尽切换到占位层
            onError={() => this.setState({ idx: this.state.idx + 1 })}
          />
        </View>
        <View style={{ width: '100%', height: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', display: showImg ? 'none' : 'flex' }}>
          {fallback !== undefined ? fallback : <Icon name={fallbackIcon} size={fallbackSize} color={fallbackColor} />}
        </View>
      </View>
    )
  }
}
