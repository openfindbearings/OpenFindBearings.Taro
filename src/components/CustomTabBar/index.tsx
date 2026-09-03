import { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { House, Store, User } from 'lucide-react-taro'
import './index.scss'

/** 商家入驻状态 */
interface MerchantState {
  approved: boolean
  logo: string | null
  name: string
}

/** 获取商家状态 */
function getMerchantState(): MerchantState {
  try {
    const approved = Taro.getStorageSync('merchant_approved')
    const logo = Taro.getStorageSync('merchant_logo')
    const name = Taro.getStorageSync('merchant_name') || '商家'
    return { approved: !!approved, logo: logo || null, name }
  } catch {
    return { approved: false, logo: null, name: '商家' }
  }
}

/** TabBar 配置 */
const tabs = [
  { key: 'home', text: '首页', pagePath: '/pages/home/index' },
  { key: 'merchant', text: '入驻', pagePath: '/pages/merchant/index' },
  { key: 'my', text: '我的', pagePath: '/pages/my/index' }
]

export default function CustomTabBar() {
  const [selected, setSelected] = useState(0)
  const [merchant, setMerchant] = useState<MerchantState>({ approved: false, logo: null, name: '商家' })

  useEffect(() => {
    const pages = Taro.getCurrentPages()
    if (pages.length > 0) {
      const currentPath = '/' + pages[pages.length - 1].route
      const idx = tabs.findIndex(t => currentPath.includes(t.pagePath.replace('/pages/', '')))
      if (idx >= 0) setSelected(idx)
    }
    setMerchant(getMerchantState())
  }, [])

  const handleSwitch = (index: number, path: string) => {
    if (index === selected) return
    Taro.switchTab({ url: path })
  }

  const getIcon = (key: string) => {
    if (key === 'home') return House
    if (key === 'merchant') return Store
    return User
  }

  const getText = (key: string) => {
    if (key === 'merchant') {
      if (merchant.approved) return merchant.name
      return '入驻'
    }
    if (key === 'my') return '我的'
    return '首页'
  }

  return (
    <View className='custom-tab-bar'>
      {tabs.map((tab, idx) => {
        const isActive = idx === selected
        const isMerchant = tab.key === 'merchant'
        const highlighted = isMerchant && merchant.approved

        let IconComponent = getIcon(tab.key)
        const tabText = getText(tab.key)

        return (
          <View
            key={tab.key}
            className={`tab-item ${isActive ? 'active' : ''} ${highlighted ? 'highlighted' : ''}`}
            onClick={() => handleSwitch(idx, tab.pagePath)}
          >
            {highlighted ? (
              <View className='highlight-circle'>
                {merchant.logo ? (
                  <img src={merchant.logo} alt={merchant.name} className='merchant-logo' />
                ) : (
                  <IconComponent color='#ffffff' size={26} />
                )}
              </View>
            ) : (
              <View className='icon-wrap'>
                <IconComponent
                  color={isActive ? '#2563EB' : '#999999'}
                  size={22}
                />
              </View>
            )}
            <Text className={`tab-text ${isActive ? 'active' : ''}`}>
              {tabText}
            </Text>
          </View>
        )
      })}
    </View>
  )
}
