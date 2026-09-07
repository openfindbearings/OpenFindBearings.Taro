// 首页：公开查询入口（搜索 + 快捷三钮 + 历史/热门）
// v1.7.0 度量重构：接入 PageLayout 统一骨架（删 rnHeight/padding-bottom hack），
// 尺寸全部走 dp token；快捷入口改"实心圆 + 白图标"（更明快）；
// 简洁模式：nav=null 无顶栏，搜索框+三钮在滚动区内垂直居中，隐藏历史/热门，保留 TabBar。
import { useState, useCallback } from 'react'
import Icon from '../../components/Icon'
import { View, Input, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { getItem, setItem, removeItem } from '../../utils/storage'
import { useFs } from '../../hooks/useFontScale'
import { useTheme } from '../../hooks/useTheme'
import PageLayout from '../../components/PageLayout'
import NavBar from '../../components/NavBar'
import CustomTabBar from '../../components/CustomTabBar'
import './index.scss'

const HISTORY_KEY = 'search_history'
const SETTINGS_KEY = 'app_settings'
const MAX_HISTORY = 10

interface AppSettings {
  simpleHome?: boolean
}

// 编译期配置：禁用 createScrollPage 外层 ScrollView，滚动由 PageLayout 内部统一提供
definePageConfig({ disableScroll: true })

export default function HomePage() {
  const [keyword, setKeyword] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [simpleMode, setSimpleMode] = useState(false)
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
        try { setSimpleMode(!!(JSON.parse(savedSettings) as AppSettings).simpleHome) } catch { /* 默认 */ }
      }
    }).catch(() => { /* 默认空状态 */ })
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

  const handleHistoryClick = useCallback((kw: string) => {
    setKeyword(kw)
    saveHistory(kw)
    Taro.navigateTo({ url: `/pages/home/search?keyword=${encodeURIComponent(kw)}` })
  }, [saveHistory])

  const clearHistory = useCallback(() => {
    Taro.showModal({
      title: '提示',
      content: '确定清空搜索历史？',
      success: (res) => {
        if (res.confirm) {
          setHistory([])
          removeItem(HISTORY_KEY)
        }
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
        <View className='action-icon' onClick={() => Taro.showToast({ title: '讲语音（开发中）', icon: 'none' })}>
          <Icon name="mic" size={22} color='#475569' />
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
      <View className='quick-item' onClick={() => Taro.showToast({ title: '讲语音（开发中）', icon: 'none' })}>
        <View className='quick-icon quick-icon-voice'>
          <Icon name="mic" size={28} color='#FFFFFF' />
        </View>
        <Text className='quick-label' style={{ ...fs(13), color: t.textSecondary }}>讲语音</Text>
      </View>
      <View className='quick-item' onClick={() => Taro.showToast({ title: '拍轴承（开发中）', icon: 'none' })}>
        <View className='quick-icon quick-icon-camera'>
          <Icon name="camera" size={28} color='#FFFFFF' />
        </View>
        <Text className='quick-label' style={{ ...fs(13), color: t.textSecondary }}>拍轴承</Text>
      </View>
      <View className='quick-item' onClick={() => Taro.showToast({ title: '扫条码（开发中）', icon: 'none' })}>
        <View className='quick-icon quick-icon-scan'>
          <Icon name="scan_line" size={28} color='#FFFFFF' />
        </View>
        <Text className='quick-label' style={{ ...fs(13), color: t.textSecondary }}>扫条码</Text>
      </View>
    </View>
  )

  // 简洁模式：无 NavBar，搜索框 + 三钮垂直居中（内容区高度显式计算保证居中）
  if (simpleMode) {
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
    </PageLayout>
  )
}
