// 统一 CustomTabBar 组件（v1.7.0 度量重构，纯 RN 基准）
// 度量：栏高 56dp（Material Bottom Navigation）、图标 24dp、文字 12dp；
// 商家已入驻时中间 tab 换 56dp 大圆 + 48dp logo（无 logo 用 28dp store 图标）。
// 改动说明（本轮）：
//   1. 图标 26/30 统一改 24（Material 标准），触控由整个 tab-item（约 93×56dp）承担；
//   2. 底部安全区（手势条/Home Indicator）用 getSafeArea().bottomInset inline 注入 paddingBottom；
//   3. 大圆阴影 Android 必须手写 elevation（Taro 不自动转），iOS 用等效 shadow；
//   4. logo 加载失败 onError 回退默认 store 图标；商家名 numberOfLines=1 截断防挤压相邻 tab；
//   5. 选中文字色改 $primary-text 深档（#0284C7，保 WCAG AA 对比度）；
//   6. 删除 var() 兜底与 getColors（本轮纯 RN，SCSS 编译期变量直用）。
import { useState, useEffect } from 'react'
import Icon from '../Icon'
import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { getItem } from '../../utils/storage'
import { useSafeArea } from '../../utils/use-safe-area'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import './index.scss'

/** 商家入驻状态 */
interface MerchantState {
  approved: boolean
  logo: string | null
  name: string
  /** logo 加载失败标记：true 时回退默认 store 图标 */
  logoFailed: boolean
}

/** TabBar 配置 */
const tabs = [
  { key: 'home', text: '首页', pagePath: '/pages/home/index' },
  { key: 'merchant', text: '入驻', pagePath: '/pages/merchant/index' },
  { key: 'my', text: '我的', pagePath: '/pages/my/index' }
]

/** 获取商家入驻状态（异步；RN 不支持 getStorageSync）
 * approved 用严格字符串比较，避免 storage 中存了字符串 "false" 被误判为 true */
async function fetchMerchantState(): Promise<MerchantState> {
  const [approved, logo, name] = await Promise.all([
    getItem('merchant_approved'),
    getItem('merchant_logo'),
    getItem('merchant_name')
  ])
  return {
    // getItem 恒返回 string|null，严格字符串比较即可（审核修正：去掉与 boolean 的冗余比较）
    approved: approved === 'true',
    logo: logo || null,
    name: name || '商家',
    logoFailed: false
  }
}

export default function CustomTabBar() {
  const [selected, setSelected] = useState(0)

  // 启动时 app.tsx 已预读商家状态存入 globalData，同步读取作为初始值，避免首帧图标跳变
  const preloaded = (Taro.getApp() as any)?.globalData ?? {}
  const [merchant, setMerchant] = useState<MerchantState>({
    approved: preloaded.merchantApproved === true || preloaded.merchantApproved === 'true',
    logo: preloaded.merchantLogo || null,
    name: preloaded.merchantName || '商家',
    logoFailed: false
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
    fetchMerchantState().then(setMerchant).catch(() => { /* 默认状态 */ })
  }, [])

  const handleSwitch = (index: number, path: string) => {
    if (index === selected) return
    // Taro.switchTab 在 RN 端依赖 tabNav navigator（需 app.config 配置原生 tabBar），
    // 本项目用自绘 TabBar，改用 redirectTo（H5/RN 均为 replace 语义）实现 tab 切换
    Taro.redirectTo({ url: path })
  }

  /** TabBar key 到 Icon name 的映射（跨端统一用 Icon 抽象层） */
  function getIconName(key: string): string {
    if (key === 'home') return 'home'
    if (key === 'merchant') return 'store'
    return 'user'
  }

  // 商家 tab 文案：已入驻用商家名，否则用"入驻"
  const getMerchantText = () => {
    if (merchant.approved) return merchant.name
    return '入驻'
  }

  // 底部安全区内嵌（手势条/Home Indicator），标准 useSafeAreaInserts
  const { bottom } = useSafeArea()
  // 主题色板（栏底/边框/选中态/大圆）+ 全局字号
  const t = useTheme()
  const fs = useFs()

  // 大圆阴影双端写法：iOS 走 shadow 四件套，Android 走 elevation（Taro 不自动转换）。
  // 类型断言原因：shadow*/elevation 是 RN 专有样式属性，Taro 的 CSSProperties 类型未声明
  const highlightStyle = {
    backgroundColor: t.primary,
    shadowColor: 'rgba(15, 23, 42, 0.2)',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    shadowOpacity: 1,
    elevation: 4
  } as any

  return (
    <View className='tab-bar' style={{ paddingBottom: bottom, backgroundColor: t.tabBarBg, borderTopColor: t.tabBarBorder }}>
      {tabs.map((tab, idx) => {
        const isActive = idx === selected
        const isMerchant = tab.key === 'merchant'
        // 商家已入驻时大圆 + logo 突出（仅 approved 生效）
        const highlighted = isMerchant && merchant.approved
        const iconName = getIconName(tab.key)
        const tabText = isMerchant ? getMerchantText() : tab.text

        return (
          <View
            key={tab.key}
            className='tab-item'
            onClick={() => handleSwitch(idx, tab.pagePath)}
          >
            {highlighted ? (
              // 已入驻：56dp 大圆 + 48dp logo；无 logo 或加载失败回退 28dp store 图标
              <View className='highlight-circle' style={highlightStyle}>
                {merchant.logo && !merchant.logoFailed ? (
                  <Image
                    src={merchant.logo}
                    className='merchant-logo'
                    mode='aspectFill'
                    onError={() => setMerchant(m => ({ ...m, logoFailed: true }))}
                  />
                ) : (
                  <Icon name={iconName} color='#FFFFFF' size={28} />
                )}
              </View>
            ) : (
              // 普通 tab：图标统一 24dp（Material 标准），仅颜色区分选中态
              <View className='icon-wrap'>
                <Icon
                  name={iconName}
                  color={isActive ? t.tabBarTextActive : t.tabBarText}
                  size={24}
                />
              </View>
            )}
            {/* 商家名限 1 行截断，防长店名挤压相邻 tab；文字 12dp 随全局字号缩放，颜色随主题模式 */}
            <Text
              className={`tab-text ${isActive ? 'tab-text-active' : ''}`}
              numberOfLines={1}
              style={isActive ? { ...fs(12), color: t.tabBarTextActive } : { ...fs(12), color: t.tabBarText }}
            >
              {tabText}
            </Text>
          </View>
        )
      })}
    </View>
  )
}
