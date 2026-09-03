import { View, Text } from '@tarojs/components'
import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { getFavoriteBearings } from '../../../services/user'
import EmptyState from '../../../components/EmptyState'

/** 收藏轴承列表 */
export default function FavoriteList() {
  const [items, setItems] = useState<{ bearingId: string; createdAt: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getFavoriteBearings(1, 50)
      .then((res) => setItems(res.items))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <View className='list-loading'><Text>加载中...</Text></View>
  if (items.length === 0) return <EmptyState text='暂无收藏' icon='💝' />

  return (
    <View className='favorite-list'>
      {items.map((item) => (
        <View
          key={item.bearingId}
          className='favorite-list__item'
          onClick={() => Taro.navigateTo({ url: `/pages/home/bearingDetail/index?id=${item.bearingId}` })}
        >
          <Text className='favorite-list__id'>{item.bearingId.slice(0, 8)}...</Text>
          <Text className='favorite-list__time'>收藏于 {new Date(item.createdAt).toLocaleDateString()}</Text>
        </View>
      ))}
    </View>
  )
}
