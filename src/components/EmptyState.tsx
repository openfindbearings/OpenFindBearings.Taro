import { View, Text } from '@tarojs/components'

/** 空状态占位组件 */
export default function EmptyState({ text = '暂无数据', icon = '📭' }: { text?: string; icon?: string }) {
  return (
    <View className='empty-state'>
      <Text className='empty-state__icon'>{icon}</Text>
      <Text className='empty-state__text'>{text}</Text>
    </View>
  )
}
