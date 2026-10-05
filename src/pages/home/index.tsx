// 首页：公开查询入口（搜索 + 快捷三钮 + 历史/热门）
// v1.7.0 度量重构：接入 PageLayout 统一骨架（删 rnHeight/padding-bottom hack），
// 尺寸全部走 dp token；快捷入口改"实心圆 + 白图标"（更明快）；
// 简洁模式：nav=null 无顶栏，搜索框+三钮在滚动区内垂直居中，隐藏历史/热门，保留 TabBar。
import { useState, useCallback } from 'react'
import Icon from '../../components/Icon'
import { View, Input, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { getItem, setItem, removeItem } from '../../utils/storage'
import { getHome, type HomeData } from '../../services/home'
import MediaImage from '../../components/MediaImage'
import { useFs } from '../../hooks/useFontScale'
import { useTheme } from '../../hooks/useTheme'
// 改动说明：补 useAuthStore 导入——上一轮加"未登录降级普通模式"时只写了使用处漏了 import，
// 导致 loggedIn 抛 ReferenceError、整段降级逻辑从未生效（tsc TS2304 抓出）
import { useAuthStore } from '../../stores/auth'
import { showConfirmDialog } from '../../components/ConfirmDialog'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import CustomTabBar from '../../components/CustomTabBar'
// 改动说明（pro 扩展缝）：首页快捷三钮（语音/拍/扫）与智能模式页面已迁往自用 pro 包——
// 开源构建时 @ofb/taro-pro 被 alias 指向 src/ext/pro.ts 占位（三钮渲染空、智能模式提示暂未上线）
import { ProQuickActions, ProSearchExtras, ProSmartHome } from '../../ext/pro'
import './index.scss'

const HISTORY_KEY = 'search_history'
const SETTINGS_KEY = 'app_settings'
const MAX_HISTORY = 10

interface AppSettings {
  /** 首页模式：normal 普通 / simple 简洁 / smart 智能。缺省时由旧字段 simpleHome 迁移 */
  homeMode?: 'normal' | 'simple' | 'smart'
  simpleHome?: boolean
}

// 编译期配置：禁用 createScrollPage 外层 ScrollView，滚动由 PageLayout 内部统一提供
definePageConfig({ disableScroll: true })

export default function HomePage() {
  const [keyword, setKeyword] = useState('')
  const [history, setHistory] = useState<string[]>([])
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
    Promise.all([getItem(HISTORY_KEY), getItem(SETTINGS_KEY)]).then(([savedHist, savedSettings]) => {
      if (savedHist) {
        try { setHistory(JSON.parse(savedHist)) } catch { /* 忽略坏数据 */ }
      }
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

  const saveHistory = useCallback((kw: string) => {
    if (!kw.trim()) return
    const updated = [kw, ...history.filter(h => h !== kw)].slice(0, MAX_HISTORY)
    setHistory(updated)
    setItem(HISTORY_KEY, JSON.stringify(updated))
  }, [history])

  const handleSearch = useCallback(() => {
    if (!keyword.trim()) return
    saveHistory(keyword.trim())
    Taro.navigateTo({ url: `/pages/home/search?keyword=${encodeURIComponent(keyword.trim())}` })
  }, [keyword, saveHistory])

  // 改动说明（pro 扩展缝）：语音/拍/扫三钮实现移入 pro 包，此处直接渲染 pro 扩展组件；
  // 开源版占位返回 null（三钮不显示），自用版显示三钮
  const quickActions = <ProQuickActions t={t} fs={fs} />

  const handleHistoryClick = useCallback((kw: string) => {
    setKeyword(kw)
    saveHistory(kw)
    Taro.navigateTo({ url: `/pages/home/search?keyword=${encodeURIComponent(kw)}` })
  }, [saveHistory])

  const clearHistory = useCallback(() => {
    showConfirmDialog({ title: '提示', content: '确定清空搜索历史？' }).then((ok) => {
      if (ok) {
        setHistory([])
        removeItem(HISTORY_KEY)
      }
    })
  }, [])

  // 搜索框（普通模式放 NavBar 中间；简洁模式放内容区居中处）
  const searchBox = (
    <View className='search-input-wrap' style={{ backgroundColor: t.bgInput }}>
      <Icon name="scan_line" size={20} color={t.textSecondary} />
      <Input
        className='search-input'
        style={{ color: t.textPrimary }}
        type='text'
        placeholder='搜索轴承型号、品牌...'
        placeholderTextColor={t.textTertiary}
        value={keyword}
        onInput={(e) => setKeyword(e.detail.value)}
        onConfirm={handleSearch}
        confirmType='search'
      />
      <View className='search-actions'>
        {/* 改动说明（pro 扩展缝）：搜索框内语音/拍照快捷图标移入 pro 包，开源版不显示 */}
        <ProSearchExtras t={t} />
      </View>
    </View>
  )

  // 智能模式（pro 扩展缝）：页面骨架在主仓，内容由 pro 包渲染聊天窗；
  // 开源版占位 ProSmartHome 渲染"智能模式暂未上线"提示（存量 homeMode=smart 数据的安全兜底）
  if (effectiveMode === 'smart') {
    return (
      <PageLayout nav={<NavBar title="智能助手" />} tabbar={<CustomTabBar />} scrollY={false}>
        <ProSmartHome t={t} fs={fs} />
      </PageLayout>
    )
  }

  // 简洁模式：无 NavBar，搜索框 + 三钮垂直居中（内容区高度显式计算保证居中）
  if (effectiveMode === 'simple') {
    return (
      <PageLayout nav={null} tabbar={<CustomTabBar />}>
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

      {history.length > 0 && (
        <View className='history-section' style={{ backgroundColor: t.bgCard }}>
          <View className='section-header'>
            <View className='section-title'>
              <Icon name="clock" size={16} color={t.textTertiary} />
              <Text className='section-title-text' style={{ ...fs(15), color: t.textPrimary }}>搜索历史</Text>
            </View>
            <View className='clear-btn' onClick={clearHistory}>
              <Icon name="trash" size={14} color={t.textTertiary} />
              <Text className='clear-btn-text' style={{ ...fs(13), color: t.textTertiary }}>清空</Text>
            </View>
          </View>
          <View className='history-tags'>
            {history.map((item, idx) => (
              <View key={idx} className='history-tag' style={{ backgroundColor: t.bgInput }} onClick={() => handleHistoryClick(item)}>
                <Text className='history-tag-text' style={{ ...fs(14, true), color: t.textSecondary }}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View className='hot-section' style={{ backgroundColor: t.bgCard }}>
        <View className='section-header'>
          <View className='section-title'>
            <Icon name="flame" size={16} color={t.textTertiary} />
            <Text className='section-title-text' style={{ ...fs(15), color: t.textPrimary }}>热门搜索</Text>
          </View>
        </View>
        <View className='history-tags'>
          {['SKF', 'NSK', '6205', '6308', '轴承型号查询', '深沟球轴承'].map((item, idx) => (
            <View key={idx} className='history-tag' style={{ backgroundColor: t.bgInput }} onClick={() => handleHistoryClick(item)}>
              <Text className='history-tag-text' style={{ ...fs(14, true), color: t.textSecondary }}>{item}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 热门轴承（BFF /home 数据，public）：横向卡片，点击按型号进搜索 */}
      {home && home.hotBearings.length > 0 && (
        <View className='hot-bearings-section'>
          <View className='section-header'>
            <View className='section-title'>
              <Icon name="trending-up" size={16} color={t.textTertiary} />
              <Text className='section-title-text' style={{ ...fs(15), color: t.textPrimary }}>热门轴承</Text>
            </View>
          </View>
          {/* 改动说明（v1.7.2）：scrollX/showsHorizontalScrollIndicator 为 RN-only props，
              Taro ScrollView 类型未声明（RN 端运行时支持），spread as any 过 tsc 门禁 */}
          {/* 改动说明（weapp 适配）：小程序 scroll-view 横滚不吃"scroll-view 本身 display:flex"，
              需 white-space:nowrap + 卡片 inline-flex（weapp 专属类，RN/H5 不加保持原样） */}
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
              onClick={() => Taro.navigateTo({ url: `/pages/merchant/merchantDetail?id=${m.id}` })}
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
                <View className='merchant-badge' style={{ backgroundColor: t.primaryLight }}>
                  <Text className='merchant-badge-text' style={{ ...fs(11), color: t.primaryText }}>认证</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}
    </PageLayout>
  )
}
