import { View, Text } from '@tarojs/components'
import { useState, useEffect } from 'react'
import { getHotBearings, type Bearing } from '../../../services/bearing'
import EmptyState from '../../../components/EmptyState'

/** 热门轴承模块：从 /api/bearings/hot 获取数据 */
export default function HotBearings({ onItemTap }: { onItemTap: (id: string) => void }) {
  const [items, setItems] = useState<Bearing[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getHotBearings(10)
      .then((list) => setItems(list))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <View className='section'>
        <Text className='section__title'>热门轴承</Text>
        <Text className='section__loading'>加载中...</Text>
      </View>
    )
  }

  if (items.length === 0) return null

  return (
    <View className='section'>
      <View className='section__header'>
        <Text className='section__title'>热门轴承</Text>
        <Text className='section__more'>查看全部</Text>
      </View>
      <View className='hot-bearings'>
        {items.map((b) => (
          <View
            key={b.id}
            className='hot-bearings__item'
            onClick={() => onItemTap(b.id)}
          >
            <Text className='hot-bearings__model'>{b.partNumber}</Text>
            <Text className='hot-bearings__brand'>{b.brandName || '-'}</Text>
            {b.innerDiameter != null && b.outerDiameter != null && (
              <Text className='hot-bearings__size'>
                {b.innerDiameter}×{b.outerDiameter}×{b.width ?? '-'}
              </Text>
            )}
          </View>
        ))}
      </View>
    </View>
  )
}
