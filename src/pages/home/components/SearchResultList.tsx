import { View, Text } from '@tarojs/components'
import { Search } from 'lucide-react-taro'
import EmptyState from '../../../components/EmptyState'
import type { Bearing } from '../../../services/bearing'
import type { Merchant } from '../../../services/merchant'

/** 搜索结果列表 */
export default function SearchResultList({
  items,
  loading,
  totalCount,
  searchType,
  onBearingTap,
  onMerchantTap,
}: {
  items: (Bearing | Merchant)[]
  loading: boolean
  totalCount: number
  searchType: 'bearing' | 'merchant'
  onBearingTap: (id: string) => void
  onMerchantTap: (id: string) => void
}) {
  if (loading) {
    return <View className='search-result'><Text className='search-result__loading'>搜索中...</Text></View>
  }

  if (items.length === 0) {
    return <EmptyState text='未找到相关结果' icon={Search} />
  }

  return (
    <View className='search-result'>
      <Text className='search-result__count'>共 {totalCount} 条结果</Text>
      {searchType === 'bearing' ? (
        <View className='search-result__list'>
          {items.map((item) => {
            const b = item as Bearing
            return (
              <View key={b.id} className='bearing-card' onClick={() => onBearingTap(b.id)}>
                <View className='bearing-card__header'>
                  <Text className='bearing-card__model'>{b.partNumber}</Text>
                  <Text className='bearing-card__brand'>{b.brandName || ''}</Text>
                </View>
                {b.bearingType && <Text className='bearing-card__type'>{b.bearingType}</Text>}
                {b.innerDiameter != null && (
                  <Text className='bearing-card__size'>
                    {b.innerDiameter}×{b.outerDiameter}×{b.width ?? '-'} mm
                  </Text>
                )}
              </View>
            )
          })}
        </View>
      ) : (
        <View className='search-result__list'>
          {items.map((item) => {
            const m = item as Merchant
            return (
              <View key={m.id} className='merchant-card' onClick={() => onMerchantTap(m.id)}>
                <Text className='merchant-card__name'>{m.name}</Text>
                {m.description && (
                  <Text className='merchant-card__desc' numberOfLines={2}>{m.description}</Text>
                )}
              </View>
            )
          })}
        </View>
      )}
    </View>
  )
}
