// 勋章图鉴（H5 / 小程序入口，v1.4.47 蜜雪式改版）。
// 结构：深色 hero + 弧形分类页签 → 浅色卡片内的整页图鉴网格（左右滑动或点页签切页）→ 点击弹详情。
// 改动说明：原「大圆盘舞台平铺」在 5 枚时排成 3+2 显得散，且与下方分类列表重复展示同一批勋章；
//   现改为上半静态 hero（只交代身份与总量）、下半承担全部动效（弧面切页 + 全图鉴含未解锁进度）。
// 平台差异：本文件用 CSS transition 做位移与姿态过渡；RN 端见 index.rn.tsx（Animated + transform 数组）。
import { useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { View } from '@tarojs/components'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import type { AchievementItem } from '../../services/achievements'
import { ArcTabs, HeroBlock, MedalDetailSheet, MedalPage } from './parts'
import { arcParams, pageWidth, type MedalGalleryProps } from './types'

/** 切页与弧形过渡时长 */
const TRANSITION = 'transform 320ms ease, opacity 320ms ease'
/** 判定为一次滑动的最小水平位移 */
const SWIPE_THRESHOLD = 40

/**
 * 勋章图鉴：分类整页切换 + 弧形页签 + 详情浮层。
 */
export default function MedalGallery({ pages, avatarUrl, avatarIcon, name, subtitle, unlockedCount, totalCount, footer }: MedalGalleryProps) {
  const t = useTheme()
  const fs = useFs()
  const [index, setIndex] = useState(0)
  const [openItem, setOpenItem] = useState<AchievementItem | null>(null)
  const startX = useRef(0)
  const width = pageWidth()

  /** 弧形页签姿态：CSS transform 字符串 + 过渡（偏移 = 序号 - 当前页） */
  const styleFor = (i: number, activeIndex: number): CSSProperties => {
    const p = arcParams(i - activeIndex)
    return {
      transform: `translateY(${p.translateY}px) rotate(${p.rotateDeg}deg) scale(${p.scale})`,
      opacity: p.opacity,
      transition: TRANSITION,
    }
  }

  /** 记录按下位置，供 touchend 判定滑动方向 */
  const onTouchStart = (e: any) => {
    startX.current = e?.touches?.[0]?.clientX ?? 0
  }

  /** 松手时按位移量左右翻页（点选页签走 onSelect，两者互不冲突） */
  const onTouchEnd = (e: any) => {
    const dx = (e?.changedTouches?.[0]?.clientX ?? 0) - startX.current
    if (Math.abs(dx) < SWIPE_THRESHOLD) return
    setIndex((prev) => Math.min(pages.length - 1, Math.max(0, prev + (dx < 0 ? 1 : -1))))
  }

  return (
    <View>
      {/* 1. 深色区：hero 与弧形页签同底，视觉上是一整块 */}
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

      {/* 2. 图鉴区：整页横向位移，overflow hidden 裁掉相邻页 */}
      <View style={{ backgroundColor: t.bgCard, marginLeft: 12, marginRight: 12, marginTop: 12, borderRadius: 16, paddingTop: 14, overflow: 'hidden' }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <View style={{
          flexDirection: 'row',
          width: width * Math.max(1, pages.length),
          transform: `translateX(${-index * width}px)`,
          transition: TRANSITION,
        }}>
          {pages.map((p) => (
            <MedalPage key={p.label} page={p} width={width} onOpen={setOpenItem} fs={fs} t={t} />
          ))}
        </View>

        {/* 页点指示：页数多时给出当前位置 */}
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
