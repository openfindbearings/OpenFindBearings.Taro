import { View, Text } from '@tarojs/components'
import { User } from 'lucide-react-taro'
import './index.scss'

export default function MyPage() {
  return (
    <View className='my-page'>
      <View className='placeholder'>
        <View className='placeholder-icon'>
          <User size={48} color='#64748B' />
        </View>
        <Text className='placeholder-title'>我的</Text>
        <Text className='placeholder-desc'>收藏、关注、浏览历史</Text>
      </View>
    </View>
  )
}
