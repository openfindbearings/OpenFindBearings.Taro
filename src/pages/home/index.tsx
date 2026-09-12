// 首页：公开查询入口（搜索 + 快捷三钮 + 历史/热门）
// v1.7.0 度量重构：接入 PageLayout 统一骨架（删 rnHeight/padding-bottom hack），
// 尺寸全部走 dp token；快捷入口改"实心圆 + 白图标"（更明快）；
// 简洁模式：nav=null 无顶栏，搜索框+三钮在滚动区内垂直居中，隐藏历史/热门，保留 TabBar。
import { useState, useCallback } from 'react'
import Icon from '../../components/Icon'
import { View, Input, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { getItem, setItem, removeItem } from '../../utils/storage'
import { getHome, type HomeData } from '../../services/home'
import { usableImage } from '../../services/config'
import { useFs } from '../../hooks/useFontScale'
import { useTheme } from '../../hooks/useTheme'
// 改动说明：补 useAuthStore 导入——上一轮加"未登录降级普通模式"时只写了使用处漏了 import，
// 导致 loggedIn 抛 ReferenceError、整段降级逻辑从未生效（tsc TS2304 抓出）
import { useAuthStore } from '../../stores/auth'
import { showConfirmDialog } from '../../components/ConfirmDialog'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import CustomTabBar from '../../components/CustomTabBar'
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

  // 改动说明：离线语音识别效果未达预期，暂停接入并保留云 ASR 扩展骨架；
  // 语音入口回归"未上线"占位提示，与拍轴承/扫条码一致
  const handleVoicePlaceholder = useCallback(() => {
    Taro.showToast({ title: '语音搜索（开发中）', icon: 'none' })
  }, [])

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
      <Icon name="scan_line" size={20} color='#64748B' />
      <Input
        className='search-input'
        style={{ color: t.textPrimary }}
        type='text'
        placeholder='搜索轴承型号、品牌...'
        placeholderTextColor='#94A3B8'
        value={keyword}
        onInput={(e) => setKeyword(e.detail.value)}
        onConfirm={handleSearch}
        confirmType='search'
      />
      <View className='search-actions'>
        <View className='action-icon' onClick={handleVoicePlaceholder}>
          <Icon name='mic' size={22} color='#475569' />
        </View>
        <View className='action-icon' onClick={() => Taro.showToast({ title: '拍轴承（开发中）', icon: 'none' })}>
          <Icon name="camera" size={22} color='#475569' />
        </View>
      </View>
    </View>
  )

  // 快捷三钮：实心圆 56dp + 白图标 28dp（v1.7.0 由浅底彩图标改实心，更明快）
  const quickActions = (
    <View className='quick-actions'>
      <View className='quick-item' onClick={handleVoicePlaceholder}>
        <View className='quick-icon quick-icon-voice'>
          <Icon name='mic' size={28} color='#FFFFFF' />
        </View>
        <Text className='quick-label' style={{ ...fs(13), color: t.textSecondary }}>讲语音</Text>
      </View>
      <View className='quick-item' onClick={() => Taro.showToast({ title: '拍轴承（开发中）', icon: 'none' })}>
        <View className='quick-icon quick-icon-camera'>
          <Icon name="camera" size={28} color='#FFFFFF' />
        </View>
        <Text className='quick-label' style={{ ...fs(13), color: t.textSecondary }}>拍轴承</Text>
      </View>
      {/* 改动说明：扫码底层能力未接入，统一"暂未上线"停用文案 */}
      <View className='quick-item' onClick={() => Taro.showToast({ title: '扫码功能暂未上线', icon: 'none' })}>
        <View className='quick-icon quick-icon-scan'>
          <Icon name="scan_line" size={28} color='#FFFFFF' />
        </View>
        <Text className='quick-label' style={{ ...fs(13), color: t.textSecondary }}>扫条码</Text>
      </View>
    </View>
  )

  // 智能模式：改动说明——聊天窗未接入真实大模型，先展示"暂未上线"占位提示，
  // 保留模式设置数据，后续接入真实助手时恢复 ChatWindow 渲染
  if (effectiveMode === 'smart') {
    return (
      <PageLayout nav={<NavBar title="智能助手" />} tabbar={<CustomTabBar />} scrollY={false}>
        <View className='coming-soon' style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="sparkles" size={40} color={t.textTertiary} />
          <Text style={{ ...fs(15), color: t.textSecondary, marginTop: 12 }}>智能模式暂未上线</Text>
        </View>
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

  // 普通模式：NavBar 固定搜索框（48dp 搜索态），下方快捷三钮 + 历史 + 热门
  return (
    <PageLayout nav={<NavBar centerSlot={searchBox} searchMode />} tabbar={<CustomTabBar />}>
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
                <Text className='history-tag-text' style={{ ...fs(14), color: t.textSecondary }}>{item}</Text>
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
              <Text className='history-tag-text' style={{ ...fs(14), color: t.textSecondary }}>{item}</Text>
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
          <ScrollView className='hot-bearings-scroll' scrollX showsHorizontalScrollIndicator={false}>
            {home.hotBearings.map((b) => (
              <View
                key={b.id}
                className='bearing-card'
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
                {usableImage(m.logoUrl)
                  ? <Image className='merchant-avatar-img' src={usableImage(m.logoUrl)} mode='aspectFill' />
                  : <Icon name="store" size={20} color={t.primary} />}
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
