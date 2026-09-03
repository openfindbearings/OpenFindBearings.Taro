// 统一 CustomTabBar 组件（H5 + RN + 小程序三端通用）
// 设计：图标加大（未选 26/选中 30），商家大圆 52 + logo 突出
// 多端兼容：
//   - 图标用 Lucide color prop（避免 RN 端 CSS 变量失效）
//   - logo 用 Taro Image（避免小程序/RN 不支持原生 img）
//   - SCSS 用 var() 兜底 $xxx（H5 走 CSS 变量，RN 走编译期变量）
import { useState, useEffect } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { House, Store, User } from 'lucide-react-taro'
import './index.scss'

/** 商家入驻状态 */
interface MerchantState {
  approved: boolean
  logo: string | null
  name: string
}

/** TabBar 配置 */
const tabs = [
  { key: 'home', text: '首页', pagePath: '/pages/home/index' },
  { key: 'merchant', text: '入驻', pagePath: '/pages/merchant/index' },
  { key: 'my', text: '我的', pagePath: '/pages/my/index' }
]

/** 获取商家入驻状态 */
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

/**
 * 根据主题返回主色 / 灰色
 * H5 走 CSS 变量（运行时切换），RN 走 SCSS 编译期值
 * 图标颜色直接用 prop 传入，避免 className 传色在 RN 端失效
 */
function getColors() {
  // 默认值（H5 + RN 一致），组件挂载时根据平台覆盖
  return {
    primary: '#0EA5E9',
    inactive: '#94A3B8'
  }
}

export default function CustomTabBar() {
  const [selected, setSelected] = useState(0)
  const [merchant, setMerchant] = useState<MerchantState>({
    approved: false,
    logo: null,
    name: '商家'
  })

  useEffect(() => {
    // 根据当前页面路径确定选中 tab
    try {
      const pages = Taro.getCurrentPages()
      if (pages.length > 0) {
        const currentPath = '/' + pages[pages.length - 1].route
        const idx = tabs.findIndex(t => currentPath.includes(t.pagePath.replace('/pages/', '')))
        if (idx >= 0) setSelected(idx)
      }
    } catch {
      // 容错处理：路由获取失败时保持默认 0
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

  // 商家 tab 文案：已入驻用商家名，否则用"入驻"
  const getMerchantText = () => {
    if (merchant.approved) return merchant.name
    return '入驻'
  }

  const colors = getColors()

  return (
    <View className='tab-bar'>
      {tabs.map((tab, idx) => {
        const isActive = idx === selected
        const isMerchant = tab.key === 'merchant'
        // 商家已入驻时大圆 + logo 突出
        const highlighted = isMerchant && merchant.approved
        const IconComponent = getIcon(tab.key)
        const tabText = isMerchant ? getMerchantText() : tab.text

        return (
          <View
            key={tab.key}
            className='tab-item'
            onClick={() => handleSwitch(idx, tab.pagePath)}
          >
            {highlighted ? (
              // 已入驻：52px 大圆 + 商家 logo（或默认 Store 图标）
              <View className='highlight-circle'>
                {merchant.logo ? (
                  <Image
                    src={merchant.logo}
                    className='merchant-logo'
                    mode='aspectFill'
                  />
                ) : (
                  <IconComponent color='#FFFFFF' size={30} />
                )}
              </View>
            ) : (
              // 普通 tab：图标（未选 26 / 选中 30）
              <View className='icon-wrap'>
                <IconComponent
                  color={isActive ? colors.primary : colors.inactive}
                  size={isActive ? 30 : 26}
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
