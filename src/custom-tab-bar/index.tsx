import { useState, useEffect } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { House, Store, User } from 'lucide-react-taro'
import './index.scss'

interface TabItem {
  pagePath: string
  text: string
}

const tabs: TabItem[] = [
  { pagePath: '/pages/home/index', text: '首页' },
  { pagePath: '/pages/merchant/index', text: '入驻' },
  { pagePath: '/pages/my/index', text: '我的' }
]

export default function CustomTabBar() {
  const [selected, setSelected] = useState(0)
  const [merchantLogo, setMerchantLogo] = useState<string | null>(null)

  useEffect(() => {
    const pages = Taro.getCurrentPages()
    if (pages.length > 0) {
      const currentPath = '/' + pages[pages.length - 1].route
      const idx = tabs.findIndex(t => currentPath.includes(t.pagePath.replace('/pages/', '')))
      if (idx >= 0) setSelected(idx)
    }
    const logo = Taro.getStorageSync('merchant_logo')
    if (logo) setMerchantLogo(logo)
  }, [])

  const handleSwitch = (index: number, path: string) => {
    if (index === selected) return
    Taro.switchTab({ url: path })
  }

  const renderIcon = (index: number) => {
    const isActive = index === selected

    if (index === 1 && merchantLogo) {
      return (
        <View className='tab-icon-wrap merchant-logo'>
          <Image className='merchant-logo-img' src={merchantLogo} mode='aspectFill' />
        </View>
      )
    }

    const iconClass = `tab-icon ${isActive ? 'active' : ''}`
    const icons = [
      <House key='home' size={22} className={iconClass} />,
      <Store key='store' size={22} className={iconClass} />,
      <User key='user' size={22} className={iconClass} />
    ]

    return <View className='tab-icon-wrap'>{icons[index]}</View>
  }

  return (
    <View className='custom-tab-bar'>
      {tabs.map((tab, idx) => (
        <View
          key={idx}
          className={`tab-item ${idx === selected ? 'active' : ''}`}
          onClick={() => handleSwitch(idx, tab.pagePath)}
        >
          {renderIcon(idx)}
          <Text className={`tab-text ${idx === selected ? 'active' : ''}`}>
            {tab.text}
          </Text>
        </View>
      ))}
    </View>
  )
}
