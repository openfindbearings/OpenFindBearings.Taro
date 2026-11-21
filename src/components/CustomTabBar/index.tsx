// 统一 CustomTabBar 组件（v1.7.0 度量重构，纯 RN 基准）
// 度量：栏高 56dp（Material Bottom Navigation）、图标 24dp、文字 12dp；
// 商家已入驻时中间 tab 换 56dp 大圆 + 48dp logo（无 logo 用 28dp store 图标）。
// 改动说明（多商户）：中间商家 tab 改为直接订阅 useMerchantStore（merchants/currentMerchantId），
//   实时反映"当前商户"的 logo/名称，不再读会漂移的 merchant_logo/merchant_name 单值 storage 镜像；
//   改动说明（v1.4.28 批次二）：已入驻时点中间 tab 直达当前/默认商户工作台，切换入口移到工作台头部。
import { useState, useEffect } from 'react'
import Icon from '../Icon'
import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useSafeArea } from '../../utils/use-safe-area'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import { useMerchantStore } from '../../stores/merchant'
import { useNotificationStore } from '../../stores/notification'
import { usableImage } from '../../services/config'
import './index.scss'

/** TabBar 配置（v1.7.5 五格：首页 | 发现 | 商家 | 商城 | 我的；发现/商城为占位页） */
const tabs = [
  { key: 'home', text: '首页', pagePath: '/pages/home/index' },
  { key: 'discover', text: '发现', pagePath: '/pages/discover/index' },
  { key: 'merchant', text: '入驻', pagePath: '/pages/merchant/index' },
  { key: 'mall', text: '商城', pagePath: '/pages/mall/index' },
  { key: 'my', text: '我的', pagePath: '/pages/my/index' }
]

export default function CustomTabBar() {
  const [selected, setSelected] = useState(0)
  // logo 加载失败标记：true 时大圆内回退默认 store 图标
  const [logoFailed, setLogoFailed] = useState(false)

  // 订阅商户 store（真实事实源）：多商户列表 + 当前选中 + 切换动作
  const merchants = useMerchantStore((s) => s.merchants)
  const currentMerchantId = useMerchantStore((s) => s.currentMerchantId)
  const pendingCount = useMerchantStore((s) => s.pendingCount)
  // 改动说明：站内信未读角标——订阅 notification store；CustomTabBar 随页面切换重挂载，
  //   故 mount 时拉一次未读数即可实现"切 tab 自动刷新"，无需轮询
  const unreadCount = useNotificationStore((s) => s.unreadCount)
  const fetchUnread = useNotificationStore((s) => s.fetchUnread)
  useEffect(() => {
    void fetchUnread()
  }, [fetchUnread])
  const approved = merchants.length > 0
  // 当前商户：优先 currentMerchantId 命中，回退列表首个
  const current = merchants.find((m) => m.merchantId === currentMerchantId) ?? merchants[0] ?? null
  const merchantLogo = current?.logoUrl || null
  // 改动说明（v1.7.2）：merchantName 随 tab 文案固定"商家"后无消费方，删除僵尸变量

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
  }, [])

  /**
   * 中间商家 tab 点击（v1.4.28 批次二）：已入驻直达当前/默认商户工作台，
   * 不再进商户列表；切换入口在工作台头部「切换商户」。零商户仍进入驻页。
   */
  const onMerchantTap = () => {
    if (selected === 2) return
    if (approved) {
      Taro.redirectTo({ url: '/pages/merchant/home' })
      return
    }
    Taro.redirectTo({ url: '/pages/merchant/index' })
  }
  return (
    <View className='tab-bar' style={{ paddingBottom: bottom, backgroundColor: t.tabBarBg, borderTopColor: t.tabBarBorder }}>
      {tabs.map((tab, idx) => {
        const isActive = idx === selected
        const isMerchant = tab.key === 'merchant'
        // 商家已入驻时大圆 + logo 突出（仅 approved 生效）
        const highlighted = isMerchant && approved
        const iconName = getIconName(tab.key)
        const tabText = isMerchant ? getMerchantText() : tab.text
        // 当前商户 logo 绝对地址（无则空，回退 store 图标）
        const logoSrc = merchantLogo && !logoFailed ? usableImage(merchantLogo) : ''

        return (
          <View
            key={tab.key}
            className='tab-item'
            onClick={() => handleSwitch(idx, tab.pagePath)}
          >
            {highlighted ? (
              // 已入驻：56dp 大圆 + 48dp logo；无 logo 或加载失败回退 28dp store 图标
              <View className='highlight-circle' style={highlightStyle}>
                {logoSrc ? (
                  // 改动说明（v1.7.4）：aspectFill 裁切非正方形 logo 致视觉偏心，改 aspectFit+白底圆
                  <Image
                    src={logoSrc}
                    className='merchant-logo'
                    mode='aspectFit'
                    style={{ backgroundColor: '#FFFFFF' }}
                    onError={() => setLogoFailed(true)}
                  />
                ) : (
                  <Icon name={iconName} color='#FFFFFF' size={28} />
                )}
              </View>
            ) : (
              // 普通 tab：图标统一 24dp（Material 标准），仅颜色区分选中态；
              // "我的"tab 叠加站内信未读角标（红点数字，>99 显示 99+）
              <View className='icon-wrap' style={{ position: 'relative' }}>
                <Icon
                  name={iconName}
                  color={isActive ? t.tabBarTextActive : t.tabBarText}
                  size={24}
                />
                {tab.key === 'my' && unreadCount > 0 && (
                  <View style={{ position: 'absolute', top: -4, right: -10, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#EF4444', alignItems: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingLeft: 4, paddingRight: 4 }}>
                    <Text style={{ ...fs(10), color: '#FFFFFF' }}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                  </View>
                )}
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
