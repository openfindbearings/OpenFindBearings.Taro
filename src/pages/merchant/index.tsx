import { View, Text } from '@tarojs/components'
import { Store } from 'lucide-react-taro'
import CustomTabBar from '../../custom-tab-bar'
import './index.scss'

export default function MerchantPage() {
  return (
    <View className='merchant-page'>
      <View className='placeholder'>
        <View className='placeholder-icon'>
          <Store size={48} color='#2563EB' />
        </View>
        <Text className='placeholder-title'>入驻 / 商家</Text>
        <Text className='placeholder-desc'>商家入驻申请与店铺管理</Text>
      </View>
      <CustomTabBar />
    </View>
  )
}
