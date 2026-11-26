// 勋章摘要行（v1.4.52）：对齐高德「成就勋章」卡片——左侧标题，右侧最近 3 枚勋章图标 + 总数圆形徽标，
// 整行可点进对应勋章墙。取代原先横向 ScrollView（固定 84 高，超过 3 枚必然被裁且无滑动提示）。
import { View, Text } from '@tarojs/components'
import MedalImage from '../MedalImage'
import Icon from '../Icon'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'

/** 摘要行需要的勋章最小字段集合（与各页 AchievementWall.items 兼容） */
export interface MedalSummaryItem {
  /** 勋章唯一键 */
  key: string
  /** 勋章图相对媒体键，空则用图标占位 */
  imageKey?: string | null
  /** 占位图标名 */
  icon?: string
  /** 稀有勋章（金环） */
  rare?: boolean
  /** 勋章名（摘要行不展示，保留以兼容调用方数据） */
  name: string
}

interface MedalSummaryProps {
  /** 左侧标题（我的页「成就勋章」/ 商家侧「商家勋章」等） */
  title: string
  /** 已获得勋章列表（按解锁时间倒序，取前 3 枚展示） */
  items: MedalSummaryItem[]
  /** 已点亮总枚数（右侧圆形徽标数字） */
  total: number
  /** 整行点击回调；不传则不显示右箭头、不可点 */
  onPress?: () => void
}

/** 摘要行主体：标题 + 3 枚小勋章 + 总枚数圆形徽标（+ 可选右箭头） */
export default function MedalSummary({ title, items, total, onPress }: MedalSummaryProps) {
  const t = useTheme()
  const fs = useFs()
  const recent = items.slice(0, 3)

  return (
    <View
      onClick={onPress}
      style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}
    >
      <Text style={{ ...fs(16), color: t.textPrimary, fontWeight: '600', flex: 1 }}>{title}</Text>
      {/* 最近 3 枚：固定槽位，超出不展示也不会裁切 */}
      <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
        {recent.map((b) => (
          <View key={b.key} style={{ marginRight: 8 }}>
            <MedalImage
              size={34}
              imageKey={b.imageKey}
              icon={b.icon || 'award'}
              rare={b.rare}
              primary={t.primary}
              primaryLight={t.primaryLight}
            />
          </View>
        ))}
        {/* 总数圆形徽标（高德同款：浅灰圆底 + 数字，不写单位） */}
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: t.bgInput,
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Text style={{ ...fs(13), color: t.textSecondary }}>{total}</Text>
        </View>
      </View>
      {onPress ? <Icon name='chevron-right' size={16} color={t.textTertiary} /> : null}
    </View>
  )
}