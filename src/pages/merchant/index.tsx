// 入驻/商家页（Tab 根页）
// 标题根据入驻状态动态：已入驻显示"商家"，未入驻显示"入驻"
import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Store } from 'lucide-react-taro'
import NavBar from '../../components/NavBar'
import CustomTabBar from '../../components/CustomTabBar'
import './index.scss'

export default function MerchantPage() {
  const [approved, setApproved] = useState(false)

  useDidShow(() => {
    setApproved(!!Taro.getStorageSync('merchant_approved'))
  })

  return (
    <View className='merchant-page'>
      <NavBar title={approved ? '商家' : '入驻'} />

      <View className='placeholder'>
        <View className='placeholder-icon'>
          <Store size={48} color='#0EA5E9' />
        </View>
        <Text className='placeholder-title'>
          {approved ? '商家管理' : '商家入驻'}
        </Text>
        <Text className='placeholder-desc'>
          {approved ? '商家信息维护与商品管理' : '商家入驻申请与店铺管理'}
        </Text>
      </View>

      <CustomTabBar />
    </View>
  )
}
