import { View, Text } from '@tarojs/components'
import { useState, useEffect } from 'react'
import { getRecommendedMerchants, type Merchant } from '../../../services/merchant'
import MerchantBadge from '../../../components/MerchantBadge'

/** 推荐商家模块：从 /api/merchants/search 获取已认证商家 */
export default function RecommendedMerchants({ onItemTap }: { onItemTap: (id: string) => void }) {
  const [items, setItems] = useState<Merchant[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getRecommendedMerchants(1, 6)
      .then((res) => setItems(res.items))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <View className='section'>
        <Text className='section__title'>推荐商家</Text>
        <Text className='section__loading'>加载中...</Text>
      </View>
    )
  }

  if (items.length === 0) return null

  return (
    <View className='section'>
      <View className='section__header'>
        <Text className='section__title'>推荐商家</Text>
      </View>
      <View className='merchants-grid'>
        {items.map((m) => (
          <View
            key={m.id}
            className='merchants-grid__item'
            onClick={() => onItemTap(m.id)}
          >
            <View className='merchants-grid__name-row'>
              <Text className='merchants-grid__name'>{m.name}</Text>
              <MerchantBadge verified={m.isVerified} />
            </View>
            <Text className='merchants-grid__desc' numberOfLines={2}>
              {m.description || '暂无简介'}
            </Text>
            {m.bearingCount != null && (
              <Text className='merchants-grid__count'>在售 {m.bearingCount} 件商品</Text>
            )}
          </View>
        ))}
      </View>
    </View>
  )
}
