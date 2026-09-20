// 统一 CustomTabBar 组件（v1.7.0 度量重构，纯 RN 基准）
// 度量：栏高 56dp（Material Bottom Navigation）、图标 24dp、文字 12dp；
// 商家已入驻时中间 tab 换 56dp 大圆 + 48dp logo（无 logo 用 28dp store 图标）。
// 改动说明（多商户）：中间商家 tab 改为直接订阅 useMerchantStore（merchants/currentMerchantId），
//   实时反映"当前商户"的 logo/名称，不再读会漂移的 merchant_logo/merchant_name 单值 storage 镜像；
//   多商户时点击中间 tab 弹 MerchantSwitchSheet 切换（等价 GitHub Mobile 账户切换器）。
import { useState, useEffect } from 'react'
import Icon from '../Icon'
import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useSafeArea } from '../../utils/use-safe-area'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import { useMerchantStore } from '../../stores/merchant'
import { useNotificationStore } from '../../stores/notification'
import { showMerchantSwitchSheet, MerchantSwitchItem } from '../MerchantSwitchSheet'
import { usableImage } from '../../services/config'
import './index.scss'

/** TabBar 配置 */
const tabs = [
  { key: 'home', text: '首页', pagePath: '/pages/home/index' },
  { key: 'merchant', text: '入驻', pagePath: '/pages/merchant/index' },
  { key: 'my', text: '我的', pagePath: '/pages/my/index' }
]

export default function CustomTabBar() {
  const [selected, setSelected] = useState(0)
  // logo 加载失败标记：true 时大圆内回退默认 store 图标
  const [logoFailed, setLogoFailed] = useState(false)

  // 订阅商户 store（真实事实源）：多商户列表 + 当前选中 + 切换动作
  const merchants = useMerchantStore((s) => s.merchants)
  const currentMerchantId = useMerchantStore((s) => s.currentMerchantId)
  const switchMerchant = useMerchantStore((s) => s.switchMerchant)
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

  /** 中间商家 tab 点击：多商户弹切换 sheet（切换/申请新商户），单/零商户正常进商户页 */
  const onMerchantTap = async () => {
    if (merchants.length > 1) {
      const items: MerchantSwitchItem[] = merchants.map((m) => ({
        id: m.merchantId, name: m.merchantName, logoUrl: m.logoUrl, role: m.role
      }))
      const r = await showMerchantSwitchSheet(items, currentMerchantId)
      if (r.action === 'switch' && r.merchantId) {
        await switchMerchant(r.merchantId)
        // 切换后落到商户页，各管理页随 currentMerchantId 刷新
        Taro.redirectTo({ url: '/pages/merchant/index' })
      } else if (r.action === 'add') {
        Taro.navigateTo({ url: '/pages/merchant/apply' })
      }
      return
    }
    if (selected !== 1) Taro.redirectTo({ url: '/pages/merchant/index' })
  }

  const handleSwitch = (index: number, path: string) => {
    if (index === 1) { void onMerchantTap(); return }
    if (index === selected) return
    // 自绘 TabBar 无原生 switchTab，用 redirectTo（H5/RN 均为 replace 语义）切换
    Taro.redirectTo({ url: path })
  }

  /** TabBar key 到 Icon name 的映射（跨端统一用 Icon 抽象层） */
  function getIconName(key: string): string {
    if (key === 'home') return 'home'
    if (key === 'merchant') return 'store'
    return 'user'
  }

  // 商家 tab 文案：固定"商家"（改动说明 v1.7.2：原已生效显示商户名，长名称把 tab 撑爆，
  //   tab 是导航入口不是身份位，商户名由商户页头部承载；仅审核中提示状态；否则"入驻"）
  const getMerchantText = () => {
    if (approved) return '商家'
    if (pendingCount > 0) return '审核中'
    return '入驻'
  }

  // 底部安全区内嵌（手势条/Home Indicator），标准 useSafeAreaInserts
  const { bottom } = useSafeArea()
  // 主题色板（栏底/边框/选中态/大圆）+ 全局字号
  const t = useTheme()
  const fs = useFs()

  // 大圆阴影双端写法：iOS 走 shadow 四件套，Android 走 elevation（Taro 不自动转换）。
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
                  <Image
                    src={logoSrc}
                    className='merchant-logo'
                    mode='aspectFill'
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
                  <View style={{ position: 'absolute', top: -4, right: -10, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', paddingLeft: 4, paddingRight: 4 }}>
                    <Text style={{ fontSize: 10, lineHeight: 14, color: '#FFFFFF' }}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
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
