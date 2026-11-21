// 底部浮层面板容器（H5 / 小程序）：fixed 全屏遮罩 + 贴底卡片，点遮罩关闭。
// 改动说明（v1.4.23）：此前各面板各自写 absolute 覆盖层，嵌在页面滚动内容里会被父容器裁剪，
// H5 上只露出面板底部的「取消」行；统一抽成本组件，非 RN 端用 fixed 脱离文档流。
import type { ReactNode, CSSProperties } from 'react'
import { View } from '@tarojs/components'
import { useTheme } from '../../hooks/useTheme'

/** 浮层容器属性 */
export interface OverlaySheetProps {
  /** 是否可见（false 时整体不渲染） */
  visible: boolean
  /** 点击遮罩 / 关闭按钮时回调 */
  onClose: () => void
  /** 面板内容 */
  children: ReactNode
  /** 覆盖层额外样式（如 zIndex） */
  overlayStyle?: CSSProperties
}

/**
 * 底部浮层面板容器：遮罩 + 圆角卡片，供分享动作面板与图片面板复用。
 */
export default function OverlaySheet({ visible, onClose, children, overlayStyle }: OverlaySheetProps) {
  const t = useTheme()
  if (!visible) return null

  return (
    <View
      style={{
        position: 'fixed', left: 0, right: 0, top: 0, bottom: 0,
        width: '100%', height: '100%', zIndex: 1000,
        backgroundColor: 'rgba(0,0,0,0.45)',
        ...overlayStyle,
      }}
      onClick={onClose}
    >
      <View
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          maxHeight: '86%', overflow: 'hidden',
          backgroundColor: t.bgCard, borderTopLeftRadius: 16, borderTopRightRadius: 16,
          padding: 16, zIndex: 1001,
        }}
        onClick={(e) => e?.stopPropagation?.()}
      >
        {children}
      </View>
    </View>
  )
}