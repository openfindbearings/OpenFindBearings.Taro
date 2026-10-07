// 列表公共套件 ListKit（v2.12.0 全站列表交互统一规范）：
// 三层骨架 = ListChips（状态筛选行）+ 卡片列表（左滑 SwipeCell / 长按 ListActionSheet）+ BatchBar（多选批量条）。
// 本文件：ListChips——同类型数据的状态过滤（横向滚动 pill 行，"全部"打头，选中=主题色填充）。
// 分层原则：主 tab 只用于"两种不同的东西"；同一类东西的不同状态一律用本组件，不再叠 tab。
// RN 约束：flex 布局、无 fixed/vh、Text 包裹、数值行高带单位（H5 无单位 lineHeight 反模式规避）。
import { View, Text, ScrollView } from '@tarojs/components'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'

/** chip 条目 */
export interface ListChipItem {
  key: string
  label: string
}

interface Props {
  items: ListChipItem[]
  active: string
  onChange: (key: string) => void
}

/** 状态筛选 chips 行（页面主 tab 下方、列表上方） */
export default function ListChips({ items, active, onChange }: Props) {
  const t = useTheme()
  const fs = useFs()
  return (
    <ScrollView scrollX showsHorizontalScrollIndicator={false} style={{ maxHeight: 44 }} contentContainerStyle={{ paddingLeft: 12, paddingRight: 12, alignItems: 'center', display: 'flex', flexDirection: 'row' }}>
      {items.map((c) => {
        const on = c.key === active
        return (
          <View
            key={c.key}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingLeft: 13, paddingRight: 13, paddingTop: 5, paddingBottom: 5, borderRadius: 15, marginRight: 8, backgroundColor: on ? t.primary : t.bgInput }}
            onClick={() => onChange(c.key)}
          >
            <Text style={{ ...fs(13), color: on ? '#FFFFFF' : t.textSecondary }}>{c.label}</Text>
          </View>
        )
      })}
    </ScrollView>
  )
}
