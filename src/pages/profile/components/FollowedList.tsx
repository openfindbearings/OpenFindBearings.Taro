import { View, Text } from '@tarojs/components'
import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { getFollowedMerchants } from '../../../services/user'
import EmptyState from '../../../components/EmptyState'

/** 关注商家列表 */
export default function FollowedList() {
  const [items, setItems] = useState<{ merchantId: string; createdAt: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getFollowedMerchants(1, 50)
      .then((res) => setItems(res.items))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <View className='list-loading'><Text>加载中...</Text></View>
  if (items.length === 0) return <EmptyState text='暂无关注' icon='👥' />

  return (
    <View className='followed-list'>
      {items.map((item) => (
        <View
          key={item.merchantId}
          className='followed-list__item'
          onClick={() => Taro.navigateTo({ url: `/pages/merchant/merchantDetail/index?id=${item.merchantId}` })}
        >
          <Text className='followed-list__id'>{item.merchantId.slice(0, 8)}...</Text>
          <Text className='followed-list__time'>关注于 {new Date(item.createdAt).toLocaleDateString()}</Text>
        </View>
      ))}
    </View>
  )
}
