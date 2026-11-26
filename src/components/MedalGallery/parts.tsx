// 勋章图鉴的平台无关展示块（v1.4.47 蜜雪式改版）。
// 拆成独立文件的原因：H5/小程序（CSS transition）与 RN（Animated + transform 数组）
//   只有「整页位移与弧形姿态的写法」不同，hero、页签、网格、详情弹层的结构与配色完全一致，
//   把结构收敛在这里，两个平台入口各自只负责注入 transform 样式。
// RN 约束：仅 flex 布局、无 fixed/vh/gradient、Text 包裹文本、颜色写死值（不用 CSS 变量）。
import type { CSSProperties, ReactNode } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Icon from '../Icon'
import MedalImage from '../MedalImage'
import OverlaySheet from '../OverlaySheet'
import { arcParams, type MedalCategoryPage } from './types'
import type { AchievementItem } from '../../services/achievements'

/** 深色 hero 底色（蜜雪式：hero 恒深底，不随主题翻转，保证白字对比度） */
const HERO_BG = '#0F172A'
/** hero 主文字色 */
const HERO_TEXT = '#F8FAFC'
/** hero 次级文字色 */
const HERO_SUB = '#94A3B8'
/** hero 强调数字色（金色，呼应「点亮」） */
const HERO_GOLD = '#FBBF24'

/**
 * 深色 hero：头像 + 名称 + 已点亮 N / M 枚 + 副标题。
 * 改动说明：hero 与弧形页签共用同一块深底，故本块不再自带外边距与背景色，
 *   由外层容器统一铺 HERO_BG，避免中间出现一条浅色断带。
 */
export function HeroBlock(props: {
  avatarUrl?: string | null
  avatarIcon?: string
  name: string
  subtitle?: string | null
  unlockedCount: number
  totalCount: number
  fs: (n: number) => CSSProperties
}) {
  const { avatarUrl, avatarIcon = 'user', name, subtitle, unlockedCount, totalCount, fs } = props
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)', borderStyle: 'solid', borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)' }}>
        {avatarUrl ? (
          <Image src={avatarUrl} mode='aspectFill' style={{ width: 68, height: 68, borderRadius: 34 }} />
        ) : (
          <Icon name={avatarIcon} size={34} color={HERO_TEXT} />
        )}
      </View>
      <Text style={{ ...fs(18), color: HERO_TEXT, fontWeight: '700', marginTop: 10 }}>{name}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 6 }}>
        <Text style={{ ...fs(13), color: HERO_SUB }}>已点亮 </Text>
        <Text style={{ ...fs(17), color: HERO_GOLD, fontWeight: '700' }}>{unlockedCount}</Text>
        <Text style={{ ...fs(13), color: HERO_SUB }}> / {totalCount} 枚</Text>
      </View>
      {!!subtitle && (
        <Text style={{ ...fs(12), color: HERO_SUB, marginTop: 4 }}>{subtitle}</Text>
      )}
    </View>
  )
}

/**
 * 弧形分类页签：整条按「与当前页的偏移」做 rotate + translateY + scale + opacity，
 * 选中那枚摆正放大，两侧外倾下沉，形成弧面。切页时由外层传入新的 index，姿态随之过渡。
 */
export function ArcTabs(props: {
  pages: MedalCategoryPage[]
  index: number
  onSelect: (i: number) => void
  fs: (n: number) => CSSProperties
  /** 由平台入口注入：把「页签序号 + 当前页」变成该端可用的 transform 样式（H5 为字符串、RN 为数组，故用 any） */
  styleFor: (i: number, activeIndex: number) => any
  t: any
}) {
  const { pages, index, onSelect, fs, styleFor, t } = props
  if (pages.length <= 1) return null
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 18, marginBottom: 6, minHeight: 40 }}>
      {pages.map((p, i) => {
        const active = i === index
        const params = arcParams(i - index)
        return (
          <View
            key={p.label}
            onClick={() => onSelect(i)}
            style={{ flexGrow: 1, flexBasis: 0, alignItems: 'center', paddingLeft: 2, paddingRight: 2, ...(styleFor(i, index) as any) }}
          >
            <Text numberOfLines={1} style={{ ...fs(active ? 15 : 13), color: active ? HERO_GOLD : HERO_SUB, fontWeight: active ? '700' : '400', textAlign: 'center' }}>
              {p.label}
            </Text>
            <Text style={{ ...fs(10), color: active ? HERO_GOLD : t.textTertiary, marginTop: 2, textAlign: 'center' }}>
              {p.unlockedCount}/{p.items.length}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

/** 图鉴单元：已获得彩色 + 日期，未获得灰度 + 进度。
 *  宽度一律 33.33% 且不加横向 padding——RN 无 box-sizing，padding 会撑破 1/3 槽位导致每行只排 2 个；
 *  间距靠单元格内部居中留白实现，三端一致。 */
export function MedalCell(props: {
  item: AchievementItem
  onOpen: (item: AchievementItem) => void
  fs: (n: number) => CSSProperties
  t: any
}) {
  const { item, onOpen, fs, t } = props
  const date = item.unlockedAt ? String(item.unlockedAt).slice(0, 10) : ''
  return (
    <View
      onClick={() => onOpen(item)}
      style={{ width: '33.33%', marginBottom: 14, alignItems: 'center' }}
    >
      <View style={{ opacity: item.unlocked ? 1 : 0.45 }}>
        <MedalImage
          imageKey={item.unlocked ? item.imageKey : null}
          icon={item.icon || 'award'}
          rare={item.rare}
          variant='card'
          primary={t.primary}
          primaryLight={t.primaryLight}
          isDark={t.isDark}
          active={item.unlocked}
          size={56}
        />
      </View>
      <Text style={{ ...fs(12), color: item.unlocked ? t.textPrimary : t.textTertiary, fontWeight: item.unlocked ? '600' : '400', marginTop: 6, textAlign: 'center' }} numberOfLines={1}>
        {item.name}
      </Text>
      <Text style={{ ...fs(10), color: t.textTertiary, marginTop: 2, textAlign: 'center' }} numberOfLines={1}>
        {item.unlocked ? (date || '已获得') : `${item.progress}/${item.target}`}
      </Text>
    </View>
  )
}

/** 单页内容：该分类全部勋章的三列网格。
 *  width 为百分比字符串（H5/小程序按 100/页数 等分；RN 传 100%，一次只渲染当前页）。 */
export function MedalPage(props: {
  page: MedalCategoryPage
  width: string
  onOpen: (item: AchievementItem) => void
  fs: (n: number) => CSSProperties
  t: any
}) {
  const { page, width, onOpen, fs, t } = props
  return (
    <View style={{ width: width as any, flexDirection: 'row', flexWrap: 'wrap' }}>
      {page.items.map((item) => (
        <MedalCell key={item.key} item={item} onOpen={onOpen} fs={fs} t={t} />
      ))}
    </View>
  )
}

/** 详情浮层：大徽章 + 名称与标签 + 描述 + 日期或进度 + 积分 */
export function MedalDetailSheet(props: {
  item: AchievementItem | null
  onClose: () => void
  fs: (n: number) => CSSProperties
  t: any
}) {
  const { item, onClose, fs, t } = props
  if (!item) return null
  const pct = item.target > 0 ? Math.min(100, Math.round((item.progress / item.target) * 100)) : 0
  const date = item.unlockedAt ? String(item.unlockedAt).slice(0, 10) : ''
  return (
    <OverlaySheet visible={!!item} onClose={onClose}>
      <View style={{ alignItems: 'center', paddingTop: 18, paddingBottom: 22, paddingLeft: 20, paddingRight: 20 }}>
        <MedalImage
          imageKey={item.unlocked ? item.imageKey : null}
          icon={item.icon || 'award'}
          rare={item.rare}
          variant='stage'
          primary={t.primary}
          primaryLight={t.primaryLight}
          isDark={t.isDark}
          active={item.unlocked}
          size={88}
        />
        <Text style={{ ...fs(18), color: t.textPrimary, fontWeight: '700', marginTop: 12 }}>{item.name}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 6 }}>
          {item.rare && <Tag text="稀有" color="#B45309" bg="#FEF3C7" fs={fs} />}
          {!!item.titleReward && <Tag text={`称号·${item.titleReward}`} color={t.primary} bg={t.primaryLight} fs={fs} />}
          {item.isLimited && <Tag text="限量" color={t.danger} bg={t.bgInput} fs={fs} />}
        </View>
        <Text style={{ ...fs(13), color: t.textSecondary, marginTop: 12, textAlign: 'center' }}>{item.description}</Text>
        {item.unlocked ? (
          <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 10 }}>{date ? `${date} 点亮` : '已点亮'}</Text>
        ) : (
          <View style={{ width: '100%', marginTop: 14 }}>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: t.borderColor }}>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: t.primary, width: `${pct}%` }} />
            </View>
            <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 6, textAlign: 'center' }}>
              进度 {item.progress}/{item.target}
            </Text>
          </View>
        )}
        <Text style={{ ...fs(14), color: t.primary, fontWeight: '700', marginTop: 12 }}>+{item.metaPoints} 勋章点</Text>
        <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 4 }}>勋章点为荣誉值，不可消费</Text>
      </View>
    </OverlaySheet>
  )
}

/** 详情浮层里的小标签 */
function Tag(props: { text: string; color: string; bg: string; fs: (n: number) => CSSProperties }): ReactNode {
  const { text, color, bg, fs } = props
  return (
    <Text style={{ ...fs(11), color, backgroundColor: bg, borderRadius: 6, paddingLeft: 8, paddingRight: 8, paddingTop: 3, paddingBottom: 3, marginLeft: 4, marginRight: 4 }}>
      {text}
    </Text>
  )
}
