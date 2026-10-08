// ListKit·BatchBar：多选模式的列表尾批量条（v2.12.0 全站列表统一）。
// 渲染位置=列表内容末尾（RN 不支持 fixed/sticky，选择模式时列表已可滚动到底操作；
// 卡片列表普遍 ≤100 条，置底可接受）。未选时动作按钮置灰，防误触。
import { View, Text } from '@tarojs/components'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'

interface Props {
  /** 是否选择模式 */
  visible: boolean
  /** 已选数量 */
  count: number
  /** 主按钮文案（如"删除"/"标为已读"） */
  actionLabel: string
  /** 可选次按钮（主题色，如通知多选"标为已读"+删除并存），未传不渲染 */
  secondaryLabel?: string
  onSecondary?: () => void
  /** 危险操作（删除类）红底 */
  danger?: boolean
  onAction: () => void
  onExit: () => void
}

/** 多选批量操作条 */
// 改动说明（RN 报错修复）：函数签名原漏解构 secondaryLabel/onSecondary，
// 函数体引用未声明标识符在 Hermes 严格模式下抛 ReferenceError（多选模式一显示即崩）——补齐解构
export default function BatchBar({ visible, count, actionLabel, secondaryLabel, onSecondary, danger = true, onAction, onExit }: Props) {
  const t = useTheme()
  const fs = useFs()
  if (!visible) return null
  return (
    <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginLeft: 12, marginRight: 12, marginTop: 12, marginBottom: 20, paddingLeft: 14, paddingRight: 14, paddingTop: 10, paddingBottom: 10, backgroundColor: t.bgCard, borderRadius: 12 }}>
      <Text style={{ ...fs(13), color: t.textSecondary, flex: 1 }}>已选 {count} 项</Text>
      {secondaryLabel ? (
        <View
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingLeft: 16, paddingRight: 16, paddingTop: 7, paddingBottom: 7, borderRadius: 16, marginRight: 8, backgroundColor: count > 0 ? t.primary : t.bgInput }}
          onClick={() => { if (count > 0 && onSecondary) onSecondary() }}
        >
          <Text style={{ ...fs(13), color: count > 0 ? '#FFFFFF' : t.textTertiary }}>{secondaryLabel}</Text>
        </View>
      ) : null}
      <View
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingLeft: 16, paddingRight: 16, paddingTop: 7, paddingBottom: 7, borderRadius: 16, marginRight: 8, backgroundColor: t.bgInput }}
        onClick={onExit}
      >
        <Text style={{ ...fs(13), color: t.textSecondary }}>取消</Text>
      </View>
      <View
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingLeft: 16, paddingRight: 16, paddingTop: 7, paddingBottom: 7, borderRadius: 16, backgroundColor: count > 0 ? (danger ? t.danger : t.primary) : t.bgInput }}
        onClick={() => { if (count > 0) onAction() }}
      >
        <Text style={{ ...fs(13), color: count > 0 ? '#FFFFFF' : t.textTertiary }}>{actionLabel}{count > 0 ? ` (${count})` : ''}</Text>
      </View>
    </View>
  )
}
