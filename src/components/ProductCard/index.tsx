// 商品卡（v2.14.0 商城导购）：两列网格卡片——图 + 型号 + 品牌/尺寸 + 价格 + 商家 + 操作位。
// 操作位走扩展点 ProProductAction（默认"联系商家"，实现由 ext/pro 覆盖；共享骨架、行为差异收敛在扩展点）。
// RN 约束：仅 flex 布局、无 fixed/vh、Text 包裹、lineHeight/fontSize 数值。
import { View, Text } from '@tarojs/components'
import MediaImage from '../MediaImage'
import Icon from '../Icon'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import { ProProductAction } from '../../ext/pro'
import type { MallFeedItem } from '../../services/mall'

interface ProductCardProps {
  /** 货源条目（某商家在某轴承上的在售） */
  item: MallFeedItem
  /** 卡片主体点击：进货源详情（轴承详情，看全部商家与报价） */
  onPress: () => void
  /** 商家行点击：进店铺页 */
  onMerchant: () => void
}

/** 价格文案：可见且有数值价→¥价；否则退价格描述；再否则"面议" */
function priceText(item: MallFeedItem): string {
  if (item.isPriceVisible && item.numericPrice != null) return `¥${item.numericPrice}`
  if (item.priceDescription) return item.priceDescription
  return '价格面议'
}

/** 商品卡：两列网格单元 */
export default function ProductCard({ item, onPress, onMerchant }: ProductCardProps) {
  const t = useTheme()
  const fs = useFs()

  return (
    <View style={{ width: '100%', backgroundColor: t.bgCard, borderRadius: 12, overflow: 'hidden', marginBottom: 10 }}>
      {/* 主图（点击进货源详情） */}
      <View onClick={onPress} style={{ display: 'flex' }}>
        <MediaImage
          url={item.image3DUrl || item.image2DUrl}
          fallbacks={[item.image2DUrl]}
          style={{ width: '100%', height: 150, backgroundColor: t.bgInput }}
          mode='aspectFit'
          fallbackIcon='package'
          fallbackColor={t.textTertiary}
          fallbackSize={34}
        />
      </View>

      <View style={{ padding: 10, display: 'flex', flexDirection: 'column' }}>
        {/* 型号 + 在售/补货态 */}
        <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
          <Text numberOfLines={1} style={{ ...fs(15, true), color: t.textPrimary, flex: 1 }}>{item.bearingPartNumber || '—'}</Text>
          {item.saleState === 2 ? (
            <View style={{ backgroundColor: t.warning || '#F59E0B', borderRadius: 4, paddingLeft: 5, paddingRight: 5, paddingTop: 1, paddingBottom: 1, marginLeft: 4 }}>
              <Text style={{ ...fs(10), color: '#FFFFFF' }}>补货中</Text>
            </View>
          ) : null}
        </View>

        {/* 品牌 · 类型 */}
        <Text numberOfLines={1} style={{ ...fs(12), color: t.textSecondary, marginTop: 3 }}>
          {(item.brandName || '未知品牌')}{item.bearingTypeName ? ` · ${item.bearingTypeName}` : ''}
        </Text>
        {/* 尺寸 d×D×B */}
        {item.dimensions ? (
          <Text numberOfLines={1} style={{ ...fs(11), color: t.textTertiary, marginTop: 2 }}>{item.dimensions}</Text>
        ) : null}

        {/* 价格 */}
        <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'baseline', marginTop: 6 }}>
          <Text numberOfLines={1} style={{ ...fs(16, true), color: t.primary }}>{priceText(item)}</Text>
        </View>

        {/* 商家行（点击进店铺） */}
        <View
          style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginTop: 8 }}
          onClick={onMerchant}
        >
          <Icon name='store' size={13} color={t.textTertiary} />
          <Text numberOfLines={1} style={{ ...fs(11), color: t.textSecondary, marginLeft: 4, flex: 1 }}>
            {item.merchantName || '商家'}
          </Text>
          {item.merchantIsVerified ? (
            <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginLeft: 4 }}>
              <Icon name='check-circle' size={12} color={t.primary} />
              <Text style={{ ...fs(10), color: t.primary, marginLeft: 2 }}>认证</Text>
            </View>
          ) : null}
        </View>

        {/* 操作位（扩展点：默认"联系商家"，实现由 ext/pro 覆盖） */}
        <View style={{ marginTop: 8, display: 'flex', flexDirection: 'row', justifyContent: 'flex-end' }}>
          <ProProductAction t={t} fs={fs} onPress={onPress} />
        </View>
      </View>
    </View>
  )
}