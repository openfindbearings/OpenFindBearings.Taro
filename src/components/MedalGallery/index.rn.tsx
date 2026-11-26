// 勋章图鉴（RN 入口，v1.4.47 蜜雪式改版；v1.4.48 修白屏）。
// 与 H5/小程序版结构一致，差异只在两处平台写法：
//   1. transform 必须用数组形式（RN 不支持 CSS transform 字符串，也不支持 CSS transition）；
//   2. 手势用 PanResponder（RN 的 View 拿不到 touches 坐标）。
// 改动说明（v1.4.48 白屏修复）：原实现用 Animated.Value 插值做过渡，Hermes 下
//   Animated.View 构造时抛 "TypeError: cannot add a new property"，整页被 ErrorBoundary 兜成白屏；
//   改为 requestAnimationFrame 推进一个连续的浮动页码 pos，样式全部由 pos 现算，
//   不依赖 Animated / reanimated / pager-view，纯 JS，无需重编 APK。
import { useEffect, useRef, useState } from 'react'
import { PanResponder } from 'react-native'
import { View, Text } from '@tarojs/components'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import type { AchievementItem } from '../../services/achievements'
import { ArcTabs, HeroBlock, MedalDetailSheet, MedalPage } from './parts'
import { arcParams, type MedalGalleryProps } from './types'

/** 切页过渡时长（与 H5 版保持一致） */
const DURATION = 280
/** 判定为一次滑动的最小水平位移 */
const SWIPE_THRESHOLD = 40

/**
 * 勋章图鉴（RN）：分类整页切换 + 弧形页签 + 详情浮层。
 */
export default function MedalGallery({ pages, avatarUrl, avatarIcon, name, subtitle, unlockedCount, totalCount, footer }: MedalGalleryProps) {
  const t = useTheme()
  const fs = useFs()
  const [index, setIndex] = useState(0)
  // 连续页码（可为小数）：切页时由 rAF 从旧值缓动到新值，弧形姿态与整页位移都读它
  const [pos, setPos] = useState(0)
  const posRef = useRef(0)
  const [openItem, setOpenItem] = useState<AchievementItem | null>(null)

  const max = Math.max(0, pages.length - 1)

  // 页码变化时用 rAF 缓动：easeOutCubic，约 280ms 停到目标页
  useEffect(() => {
    const from = posRef.current
    const to = index
    if (from === to) return
    const start = Date.now()
    let raf = 0
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / DURATION)
      const eased = 1 - Math.pow(1 - p, 3)
      const v = from + (to - from) * eased
      posRef.current = v
      setPos(v)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [index])

  /**
   * 弧形页签姿态：把「序号 - 连续页码」的偏移现算成 transform 数组。
   * RN 的 rotate 需要带 deg 的字符串，translateY/scale 用数值。
   */
  const styleFor = (i: number) => {
    const p = arcParams(i - posRef.current)
    return {
      transform: [{ translateY: p.translateY }, { rotate: `${p.rotateDeg}deg` }, { scale: p.scale }],
      opacity: p.opacity,
    }
  }

  // 手势：横向滑动超过阈值即翻页；纵向交给外层 ScrollView
  const pan = useRef<ReturnType<typeof PanResponder.create> | null>(null)
  if (!pan.current) {
    pan.current = PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_e, g) => {
        if (Math.abs(g.dx) < SWIPE_THRESHOLD) return
        setIndex((prev) => Math.min(max, Math.max(0, prev + (g.dx < 0 ? 1 : -1))))
      },
    })
  }

  return (
    <View>
      {/* 1. 深色区：hero 与弧形页签同底 */}
      <View style={{ backgroundColor: '#0F172A', marginLeft: 12, marginRight: 12, borderRadius: 16, paddingTop: 20, paddingBottom: 12 }}>
        <HeroBlock
          avatarUrl={avatarUrl}
          avatarIcon={avatarIcon}
          name={name}
          subtitle={subtitle}
          unlockedCount={unlockedCount}
          totalCount={totalCount}
          fs={fs}
        />
        <ArcTabs pages={pages} index={index} onSelect={setIndex} fs={fs} styleFor={styleFor} t={t} />
      </View>

      {/* 2. 图鉴区：整页位移，overflow hidden 裁掉相邻页 */}
      <View
        style={{ backgroundColor: t.bgCard, marginLeft: 12, marginRight: 12, marginTop: 12, borderRadius: 16, paddingTop: 14, overflow: 'hidden' }}

        {...pan.current.panHandlers}
      >
        {/* RN 只能渲染当前页：Taro 在 RN 下会把样式数值按设计稿缩放，按像素整页位移无法与百分比布局对齐，
            故不横向滑动（页签切换仍带弧面缓动），避免出现每行只排 2 列或错位 */}
        {pages[index] ? (
          <MedalPage key={pages[index].label} page={pages[index]} width='100%' onOpen={setOpenItem} fs={fs} t={t} />
        ) : null}

        {pages.length > 1 && (
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 4, marginBottom: 10 }}>
            {pages.map((p, i) => (
              <View key={p.label} style={{ width: 6, height: 6, borderRadius: 3, marginLeft: 3, marginRight: 3, backgroundColor: i === Math.round(pos) ? t.primary : t.borderColor }} />
            ))}
          </View>
        )}
      </View>

      {footer}

      <MedalDetailSheet item={openItem} onClose={() => setOpenItem(null)} fs={fs} t={t} />
    </View>
  )
}