import { View, Text } from '@tarojs/components'
import { Store } from 'lucide-react-taro'
import CustomTabBar from '../../components/CustomTabBar'
import './index.scss'

/** 入驻 / 商家页：NavBar + 占位内容 */
export default function MerchantPage() {
  return (
    <View className='merchant-page'>
      <View className='nav-bar'>
        <Text className='nav-bar-title'>入驻</Text>
      </View>
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
