// 商家等级徽章（v1.7.62 徽章统一）：全站商家等级标签的唯一渲染入口。
// 互联网来源商家在库里同样是 Ordinary(1)，但它们没有账号、尚未入驻，
// 因此这里覆盖为「互联网」描边标签（不是牌级档位，只是"还不是平台商家"的说明），
// 避免出现「普通 + 互联网数据」两枚并列造成的拥挤与语义混乱。
// 阶梯口径：互联网（描边灰）→ 普通（实心石板灰）→ 铜牌 → 银牌 → 金牌。
// RN 约束：仅 View/Text + flex，无 fixed/vh/CSS 变量，字号走 useFs
import { View, Text } from '@tarojs/components'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import { getMerchantGradeBadge } from '../../utils/level'
import Icon from '../Icon'

interface MerchantBadgeProps {
  /** 牌级序数 1~4（1 普通 / 2 铜牌 / 3 银牌 / 4 金牌）；0 或不传表示未定级，不渲染 */
  rank?: number
  /** 互联网来源商家：显示「互联网」描边标签（优先于 rank） */
  isInternetSource?: boolean
  /** 字号基准，默认 10（列表行）；详情页头部可传 11 */
  size?: number
  /** 实心牌级前是否显示徽章图标（详情页头部用，列表行不显示） */
  withIcon?: boolean
}

/** 商家等级徽章：互联网来源出描边灰标签，其余按牌级出实心彩牌 */
export default function MerchantBadge({ rank = 0, isInternetSource, size = 10, withIcon = false }: MerchantBadgeProps) {
  const t = useTheme()
  const fs = useFs()
  const badge = getMerchantGradeBadge(rank, isInternetSource)
  if (!badge) return null

  const box = {
    marginLeft: 6,
    // 改动说明（长名称重叠修复 v2）：徽章宽度固定，不参与所在 flex 行的收缩，
    // 否则 H5/小程序的默认 flex-shrink:1 会把徽章压扁成两行
    flexShrink: 0,
    paddingLeft: 5,
    paddingRight: 5,
    paddingTop: 2,
    paddingBottom: 2,
    borderRadius: 4,
    display: 'flex' as const,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  }

  // 互联网：描边灰标签——不是平台商家，不用实心牌，视觉上比"普通"更轻
  if (badge.outlined) {
    return (
      <View style={{ ...box, borderStyle: 'solid', borderWidth: 1, borderColor: t.border }}>
        <Text style={{ ...fs(size), color: t.textTertiary }}>{badge.label}</Text>
      </View>
    )
  }

  // 牌级：实心彩牌白字（普通石板灰 / 铜 / 银 / 金）
  return (
    <View style={{ ...box, backgroundColor: badge.bg }}>
      {withIcon ? <Icon name="badge-check" size={size + 1} color="#FFFFFF" /> : null}
      <Text style={{ ...fs(size), color: '#FFFFFF', fontWeight: 'bold', marginLeft: withIcon ? 3 : 0 }}>{badge.label}</Text>
    </View>
  )
}
