import { View, Text } from '@tarojs/components'
import { useState, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { BookOpen } from 'lucide-react-taro'
import { getBrowseHistory } from '../../../services/user'
import EmptyState from '../../../components/EmptyState'

/** 浏览记录列表 */
export default function HistoryList() {
  const [items, setItems] = useState<{ bearingId: string; viewedAt: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getBrowseHistory(1, 50)
      .then((res) => setItems(res.items))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <View className='list-loading'><Text>加载中...</Text></View>
  if (items.length === 0) return <EmptyState text='暂无浏览记录' icon={BookOpen} />

  return (
    <View className='history-list'>
      {items.map((item) => (
        <View
          key={item.bearingId}
          className='history-list__item'
          onClick={() => Taro.navigateTo({ url: `/pages/home/bearingDetail/index?id=${item.bearingId}` })}
        >
          <Text className='history-list__id'>{item.bearingId.slice(0, 8)}...</Text>
          <Text className='history-list__time'>浏览于 {new Date(item.viewedAt).toLocaleDateString()}</Text>
        </View>
      ))}
    </View>
  )
}
