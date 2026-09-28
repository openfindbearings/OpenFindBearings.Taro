// 跨端勋章图组件（v2.6.0 勋章图片管线）：后台配了勋章图则用 MediaImage 渲染真图，
// 无图回退双层环+图标占位（rare 金环/普通主题色环，两张尺寸档位）。
// 复用 MediaImage 的候选链/加载失败降级与 usableImage 相对键解析，三端一致。
import { View } from '@tarojs/components'
import MediaImage from '../MediaImage'
import Icon from '../Icon'

interface MedalImageProps {
  /** 勋章图相对媒体键（带 / 前缀；空则回退占位） */
  imageKey?: string | null
  /** 占位图标名（lucide icon 名） */
  icon?: string
  /** 稀有勋章（金色环 + 金色 icon） */
  rare?: boolean
  /** 尺寸档位：stage=大舞台环(96)/card=小卡片环(52)，默认 card */
  variant?: 'stage' | 'card'
  /** 主题色（普通级环色，浅色主题用） */
  primary: string
  /** 深色主题（普通级 ring 用淡紫、icon 用浅紫） */
  isDark?: boolean
  /** 是否高亮（舞台选中实亮 / 未选中半透明） */
  active?: boolean
  /** 主题浅色底（card 普通级内底色） */
  primaryLight?: string
  /** 覆盖默认尺寸（默认 stage=96 / card=52，列表卡 44 等场景传值） */
  size?: number
}

export default function MedalImage({
  imageKey,
  icon = 'award',
  rare,
  variant = 'card',
  primary,
  isDark = false,
  active = true,
  primaryLight,
  size
}: MedalImageProps) {
  const stage = variant === 'stage'
  const outer = size ?? (stage ? 96 : 52)
  const ring = rare ? '#F59E0B' : (stage ? (isDark ? '#A78BFA' : primary) : primary)
  const iconColor = rare
    ? (isDark ? '#FDE68A' : '#B45309')
    : (stage ? (isDark ? '#E9D5FF' : primary) : primary)
  // 浅色主题普通级内底色：舞台半透明紫 / 卡片用主题浅色底（无则退半透明紫）
  const bg = rare
    ? 'rgba(245,158,11,0.12)'
    : (stage ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(99,102,241,0.08)')
      : (primaryLight ?? 'rgba(99,102,241,0.08)'))

  return (
    <View style={{ width: outer, height: outer, borderRadius: outer / 2, borderWidth: stage ? 3 : 2, borderColor: ring, alignItems: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', backgroundColor: bg, opacity: active ? 1 : 0.4, overflow: 'hidden' }}>
      {imageKey ? (
        // 后台配置了勋章图：环内存真实图片（方形图裁成圆环），加载失败自动回退图标
        <MediaImage
          url={imageKey}
          fallbackIcon={icon}
          fallbackColor={iconColor}
          fallbackSize={stage ? 40 : 22}
          style={{ width: stage ? 70 : (outer - 12), height: stage ? 70 : (outer - 12), borderRadius: stage ? 35 : ((outer - 12) / 2) }}
          mode='aspectFill'
        />
      ) : stage ? (
        // 舞台档占位：外环+内底双层圆模拟勋章金属边框
        <View style={{ width: 80, height: 80, borderRadius: 40, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(15,23,42,0.12)', alignItems: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <Icon name={icon} size={40} color={iconColor} />
        </View>
      ) : (
        // 卡片档占位：单环+icon（内缩 12px 保持视觉平衡）
        <Icon name={icon} size={Math.max(14, Math.round(outer * 0.42))} color={iconColor} />
      )}
    </View>
  )
}
