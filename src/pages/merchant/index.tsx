// 入驻/商家页（Tab 根页）
// v1.7.0 度量重构：接入 PageLayout（删 rnHeight/自管 ScrollView hack）
// 标题根据入驻状态动态：已入驻显示"商家"，未入驻显示"入驻"
import { useState } from 'react'
import Icon from '../../components/Icon'
import { View, Text } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import { getItem } from '../../utils/storage'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../components/PageLayout'
import NavBar from '../../components/NavBar'
import CustomTabBar from '../../components/CustomTabBar'
import './index.scss'

// 编译期配置：禁用外层 ScrollView，滚动由 PageLayout 内部统一提供
definePageConfig({ disableScroll: true })

export default function MerchantPage() {
  const [approved, setApproved] = useState(false)
  // 主题色板（占位图标底/图标/文字随模式）+ 全局字号
  const t = useTheme()
  const fs = useFs()

  useDidShow(() => {
    // 严格字符串比较（getItem 恒返回 string|null），避免 storage 中 "false" 字符串被误判为 true
    getItem('merchant_approved').then(v => setApproved(v === 'true')).catch(() => { /* 默认未入驻 */ })
  })

  return (
    <PageLayout nav={<NavBar title={approved ? '商家' : '入驻'} />} tabbar={<CustomTabBar />}>
      <View className='placeholder'>
        <View className='placeholder-icon' style={{ backgroundColor: t.primaryLight }}>
          <Icon name="store" size={48} color={t.primary} />
        </View>
        <Text className='placeholder-title' style={{ ...fs(17), color: t.textPrimary }}>
          {approved ? '商家管理' : '商家入驻'}
        </Text>
        <Text className='placeholder-desc' style={{ ...fs(14), color: t.textTertiary }}>
          {approved ? '商家信息维护与商品管理' : '商家入驻申请与店铺管理'}
        </Text>
      </View>
    </PageLayout>
  )
}
