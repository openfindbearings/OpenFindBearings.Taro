// 首页：公开查询入口（搜索 + 快捷三钮 + 历史/热门）
// v1.7.0 度量重构：接入 PageLayout 统一骨架（删 rnHeight/padding-bottom hack），
// 尺寸全部走 dp token；快捷入口改"实心圆 + 白图标"（更明快）；
// 简洁模式：nav=null 无顶栏，搜索框+三钮在滚动区内垂直居中，隐藏历史/热门，保留 TabBar。
import { useState } from 'react'
import Icon from '../../components/Icon'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { getItem } from '../../utils/storage'
import { getHome, type HomeData } from '../../services/home'
import MediaImage from '../../components/MediaImage'
import { useFs } from '../../hooks/useFontScale'
import { useTheme } from '../../hooks/useTheme'
// 改动说明：补 useAuthStore 导入——上一轮加"未登录降级普通模式"时只写了使用处漏了 import，
// 导致 loggedIn 抛 ReferenceError、整段降级逻辑从未生效（tsc TS2304 抓出）
import { useAuthStore } from '../../stores/auth'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import CustomTabBar from '../../components/CustomTabBar'
// 改动说明（扩展点）：首页快捷三钮（语音/拍/扫）与智能模式页面由 src/ext/pro 闭源实现提供——
// 开源基座仓库在相同路径提供占位空实现（三钮渲染空、无智能模式选项），本闭源仓库此处即真实实现
import { ProQuickActions, ProSearchExtras, ProSmartHome } from '../../ext/pro'
import { openMerchant } from '../../utils/merchantNav'
import { scanAndOpen } from '../../utils/scanRoute'
import './index.scss'
// 改动说明：weapp 横滚适配类（display/white-space/vertical-align 等 RN 无效属性）按平台引入，
//   仅微信小程序构建打包，RN/H5 不再解析该文件（与 ShareButton 同款条件 require 写法）
if (process.env.TARO_ENV === 'weapp') require('./index.weapp.scss')

const SETTINGS_KEY = 'app_settings'

interface AppSettings {
  /** 首页模式：normal 普通 / simple 简洁 / smart 智能。缺省时由旧字段 simpleHome 迁移 */
  homeMode?: 'normal' | 'simple' | 'smart'
  simpleHome?: boolean
}

// 编译期配置：禁用 createScrollPage 外层 ScrollView，滚动由 PageLayout 内部统一提供
definePageConfig({ disableScroll: true })

export default function HomePage() {
  const [homeMode, setHomeMode] = useState<'normal' | 'simple' | 'smart'>('normal')
  // 改动说明：简洁模式有登录门槛（设置页只拦"切换"，拦不住"存量设置"）——
  // 未登录时显示级降级为普通模式，不改持久设置，重新登录后自动恢复简洁
  const loggedIn = useAuthStore((s) => s.isLoggedIn)
  const effectiveMode: 'normal' | 'simple' | 'smart' =
    !loggedIn && homeMode === 'simple' ? 'normal' : homeMode
  // 首页聚合数据（热门轴承 + 推荐商家），来自 BFF /mobile/home（public）
  const [home, setHome] = useState<HomeData | null>(null)
  // 全局字号缩放生成器
  const fs = useFs()
  // 主题色板（搜索框/卡片/标签/文字随模式）
  const t = useTheme()

  useDidShow(() => {
    getItem(SETTINGS_KEY).then((savedSettings) => {
      if (savedSettings) {
        try {
          const s = JSON.parse(savedSettings) as AppSettings
          // 迁移：优先 homeMode；无则由旧 simpleHome 推导（true→simple，false→normal）
          setHomeMode(s.homeMode ?? (s.simpleHome ? 'simple' : 'normal'))
        } catch { /* 默认普通 */ }
      }
    }).catch(() => { /* 默认空状态 */ })

    // 拉取首页聚合数据（public，auth:false）；失败静默降级为不显示相关区块
    getHome().then(setHome).catch(() => { /* 离线/后端未就绪时隐藏热门轴承/推荐商家 */ })
  })


  /**
   * 扫码入口（v1.4.41）：统一走 utils/scanRoute 的 scanAndOpen——内部已做平台能力探测，
   * H5 与 RN 端不会因 Taro.scanCode 缺失而崩溃（v1.4.44 修闪退）。
   */
  const handleScan = () => scanAndOpen()
  // 搜索框（v1.4.36 仿电商）：本页只作入口，点击进入搜索页；搜索历史与热词统一在搜索页展示
  const searchBox = (
    <View
      className='search-input-wrap'
      style={{ backgroundColor: t.bgInput }}
      onClick={() => Taro.navigateTo({ url: '/pages/home/searchEntry' })}
    >
      <View onClick={handleScan} style={{ width: 24, height: 24, alignItems: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <Icon name="scan_line" size={20} color={t.textSecondary} />
      </View>
      <View style={{ flex: 1, marginLeft: 8 }}>
        <Text style={{ ...fs(14), color: t.textTertiary }}>搜索轴承型号、品牌...</Text>
      </View>
      <View className='search-actions'>
        {/* 改动说明（扩展点）：右侧语音/拍照图标由 src/ext/pro 提供，开源版为空 */}
        <ProSearchExtras t={t} />
      </View>
    </View>
  )

  // 快捷入口（扩展点）：闭源实现三钮（语音/拍照/扫码），开源版渲染为空
  const quickActions = <ProQuickActions t={t} fs={fs} />

  // 智能模式（扩展点）：页面骨架在主仓，内容由 src/ext/pro 渲染聊天窗；
  // 开源版占位 ProSmartHome 渲染"智能模式暂未上线"提示（存量 homeMode=smart 数据的安全兜底）
  if (effectiveMode === 'smart') {
    return (
      <PageLayout nav={<NavBar title="智能助手" />} tabbar={<CustomTabBar />} scrollY={false}>
        <ProSmartHome t={t} fs={fs} />
      </PageLayout>
    )
  }

  // 简洁模式：无 NavBar，搜索框 + 三钮垂直居中（v1.7.48：关滚动走 PageLayout 的 flex 填充容器，
  // 让 .home-simple 的 flex:1 真正拿到内容区高度；原 ScrollView 内层无高度导致居中失效、内容贴顶压状态栏）
  if (effectiveMode === 'simple') {
    return (
      <PageLayout nav={null} tabbar={<CustomTabBar />} scrollY={false}>
        <View className='home-simple'>
          {searchBox}
          {quickActions}
        </View>
      </PageLayout>
    )
  }

  // 普通模式（v1.7.19 改版）：NavBar 显示"首页"（与其他页一致），搜索框移到导航下方
  // subHeader 吸顶区（三端一致：H5/小程序 sticky、RN/weapp 滚动区外固定），
  // 不再挤在导航栏 searchMode 里——weapp 端搜索框恢复全宽，也不与胶囊冲突
  return (
    <PageLayout
      nav={<NavBar title="首页" />}
      subHeader={<View className='home-search-sticky' style={{ backgroundColor: t.bgPage }}>{searchBox}</View>}
      tabbar={<CustomTabBar />}
    >
      {quickActions}



      {/* 热门轴承（BFF /home 数据，public）：横向卡片，点击进型号详情 */}
      {home && home.hotBearings.length > 0 && (
        <View className='hot-bearings-section'>
          <View className='section-header'>
            <View className='section-title'>
              <Icon name="trending-up" size={16} color={t.textTertiary} />
              <Text className='section-title-text' style={{ ...fs(15), color: t.textPrimary }}>热门轴承</Text>
            </View>
          </View>
          <ScrollView className={`hot-bearings-scroll${process.env.TARO_ENV === 'weapp' ? ' hot-bearings-scroll-wx' : ''}`} {...({ scrollX: true, showsHorizontalScrollIndicator: false } as any)}>
            {home.hotBearings.map((b) => (
              <View
                key={b.id}
                className={`bearing-card${process.env.TARO_ENV === 'weapp' ? ' bearing-card-wx' : ''}`}
                style={{ backgroundColor: t.bgCard }}
                onClick={() => Taro.navigateTo({ url: `/pages/home/bearingDetail?id=${b.id}` })}
              >
                <Text className='bearing-part' style={{ ...fs(15), color: t.textPrimary }}>{b.partNumber}</Text>
                <Text className='bearing-type' style={{ ...fs(12), color: t.textSecondary }}>{b.bearingType}</Text>
                <Text className='bearing-brand' style={{ ...fs(12), color: t.textTertiary }}>{b.brandName}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
      {/* 推荐商家（BFF /home 数据，public）：竖向卡片，点击进商家详情（详情页待建，先提示） */}
      {home && home.merchants.length > 0 && (
        <View className='merchant-section' style={{ backgroundColor: t.bgCard }}>
          <View className='section-header'>
            <View className='section-title'>
              <Icon name="store" size={16} color={t.textTertiary} />
              <Text className='section-title-text' style={{ ...fs(15), color: t.textPrimary }}>推荐商家</Text>
            </View>
          </View>
          {home.merchants.map((m) => (
            <View
              key={m.id}
              className='merchant-row'
              onClick={() => void openMerchant(m.id)}
            >
              <View className='merchant-avatar' style={{ backgroundColor: t.primaryLight }}>
                <MediaImage url={m.logoUrl} className='merchant-avatar-img' mode='aspectFit' fallbackIcon="store" fallbackColor={t.primary} fallbackSize={20} />
              </View>
              <View className='merchant-info'>
                <Text className='merchant-name' style={{ ...fs(15), color: t.textPrimary }}>{m.name}</Text>
                <Text className='merchant-desc' style={{ ...fs(12), color: t.textTertiary }} numberOfLines={1}>
                  {m.companyName || (m.productCount != null ? `${m.productCount} 个在售` : '')}
                </Text>
              </View>
              {m.isVerified && (
                // 改动说明（v2.13.2 认证徽标统一）：文案"认证"→"已认证"，与商户页/商品卡/寻货详情一致
                <View className='merchant-badge' style={{ backgroundColor: t.primaryLight }}>
                  <Text className='merchant-badge-text' style={{ ...fs(11), color: t.primary }}>已认证</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}
    </PageLayout>
  )
}
