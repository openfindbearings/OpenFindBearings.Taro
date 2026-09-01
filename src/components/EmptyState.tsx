import { View, Text } from '@tarojs/components'
import type { LucideIcon } from 'lucide-react-taro'
import { Inbox } from 'lucide-react-taro'

/** 空状态占位组件 */
export default function EmptyState({
  text = '暂无数据',
  icon: Icon = Inbox,
}: {
  text?: string
  icon?: LucideIcon
}) {
  return (
    <View className='empty-state'>
      <View className='empty-state__icon'>
        <Icon size={48} color='#ccc' strokeWidth={1.5} />
      </View>
      <Text className='empty-state__text'>{text}</Text>
    </View>
  )
}
