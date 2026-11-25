// 勋章图鉴（RN 入口，v1.4.47 蜜雪式改版）。
// 与 H5/小程序版结构一致，只替换两处平台差异：
//   1. 位移与弧形姿态改用 Animated.Value 插值（RN 不支持 CSS transition，transform 需数组写法）；
//   2. 手势改用 PanResponder（RN 的 onTouchEnd 拿不到 touches 坐标）。
// 不引入 reanimated / pager-view：本页只需整页位移与少量插值，RN 内置 Animated 足够，
//   且避免 babel 插件链与原生模块变更（改动说明见设计文档 v1.4.47）。
import { useEffect, useMemo, useRef, useState } from 'react'
import { Animated, PanResponder } from 'react-native'
import { View } from '@tarojs/components'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import type { AchievementItem } from '../../services/achievements'
import { ArcTabs, HeroBlock, MedalDetailSheet, MedalPage } from './parts'
import { pageWidth, type MedalGalleryProps } from './types'

/** 切页动画时长（与 H5 版保持一致） */
const DURATION = 320
/** 判定为一次滑动的最小水平位移 */
const SWIPE_THRESHOLD = 40

/**
 * 勋章图鉴（RN）：分类整页切换 + 弧形页签 + 详情浮层。
 */
export default function MedalGallery({ pages, avatarUrl, avatarIcon, name, subtitle, unlockedCount, totalCount, footer }: MedalGalleryProps) {
  const t = useTheme()
  const fs = useFs()
  const [index, setIndex] = useState(0)
  const [openItem, setOpenItem] = useState<AchievementItem | null>(null)
  const width = pageWidth()
  const max = Math.max(0, pages.length - 1)

  // 连续页位置：0..max，切页时用 timing 过渡，弧形姿态与整页位移都由它插值，天然同步
  const pos = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(pos, { toValue: index, duration: DURATION, useNativeDriver: true }).start()
  }, [index, pos])

  /** 整页横向位移 */
  const stripTranslateX = useMemo(
    () => pos.interpolate({ inputRange: [0, Math.max(1, max)], outputRange: [0, -width * max] }),
    [pos, width, max]
  )

  /**
   * 弧形页签姿态生成器：把「与当前页的偏移」插值成 rotate/translateY/scale/opacity。
   * 偏移 = 页签序号 - 连续位置，故对 pos 做反向插值；超过 ±2 页按端点钳制。
   */
  const styleFor = (i: number, _activeIndex: number) => {
    const input = [i - 2, i - 1, i, i + 1, i + 2]
    const rotate = pos.interpolate({ inputRange: input, outputRange: ['-26deg', '-13deg', '0deg', '13deg', '26deg'], extrapolate: 'clamp' })
    const translateY = pos.interpolate({ inputRange: input, outputRange: [14, 7, 0, 7, 14], extrapolate: 'clamp' })
    const scale = pos.interpolate({ inputRange: input, outputRange: [0.86, 0.9, 1.14, 0.9, 0.86], extrapolate: 'clamp' })
    const opacity = pos.interpolate({ inputRange: input, outputRange: [0.3, 0.6, 1, 0.6, 0.3], extrapolate: 'clamp' })
    return { transform: [{ translateY }, { rotate }, { scale }], opacity }
  }

  // 手势：松手时按位移方向翻页；纵向交给外层 ScrollView
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
        <Animated.View style={{ flexDirection: 'row', width: width * Math.max(1, pages.length), transform: [{ translateX: stripTranslateX }] }}>
          {pages.map((p) => (
            <MedalPage key={p.label} page={p} width={width} onOpen={setOpenItem} fs={fs} t={t} />
          ))}
        </Animated.View>

        {pages.length > 1 && (
          <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 4, marginBottom: 10 }}>
            {pages.map((p, i) => (
              <View key={p.label} style={{ width: 6, height: 6, borderRadius: 3, marginLeft: 3, marginRight: 3, backgroundColor: i === index ? t.primary : t.borderColor }} />
            ))}
          </View>
        )}
      </View>

      {footer}

      <MedalDetailSheet item={openItem} onClose={() => setOpenItem(null)} fs={fs} t={t} />
    </View>
  )
}
