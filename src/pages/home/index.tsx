import { useState, useCallback } from 'react'
import { View, Input, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Mic, Camera, ScanBarcode, Clock, Trash2 } from 'lucide-react-taro'
import CustomTabBar from '../../components/CustomTabBar'
import './index.scss'

const HISTORY_KEY = 'search_history'
const SETTINGS_KEY = 'app_settings'
const MAX_HISTORY = 10

interface AppSettings {
  simpleHome?: boolean
}

export default function HomePage() {
  const [keyword, setKeyword] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [simpleMode, setSimpleMode] = useState(false)

  useDidShow(() => {
    const saved = Taro.getStorageSync(HISTORY_KEY)
    if (saved) setHistory(JSON.parse(saved))
    const settings: AppSettings = Taro.getStorageSync(SETTINGS_KEY) || {}
    setSimpleMode(!!settings.simpleHome)
  })

  const saveHistory = useCallback((kw: string) => {
    if (!kw.trim()) return
    const updated = [kw, ...history.filter(h => h !== kw)].slice(0, MAX_HISTORY)
    setHistory(updated)
    Taro.setStorageSync(HISTORY_KEY, JSON.stringify(updated))
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
          Taro.removeStorageSync(HISTORY_KEY)
        }
      }
    })
  }, [])

  return (
    <View className={`home ${simpleMode ? 'simple' : ''}`}>
      {/* 搜索栏 */}
      <View className='search-bar'>
        <View className='search-input-wrap'>
          <ScanBarcode size={18} className='icon-tertiary scan-barcode-icon' />
          <Input
            className='search-input'
            type='text'
            placeholder='搜索轴承型号、品牌...'
            value={keyword}
            onInput={(e) => setKeyword(e.detail.value)}
            onConfirm={handleSearch}
            confirmType='search'
          />
          <View className='search-actions'>
            <View className='action-icon' onClick={() => Taro.showToast({ title: '讲语音（开发中）', icon: 'none' })}>
              <Mic size={18} className='icon-secondary' />
            </View>
            <View className='action-icon' onClick={() => Taro.showToast({ title: '拍轴承（开发中）', icon: 'none' })}>
              <Camera size={18} className='icon-secondary' />
            </View>
          </View>
        </View>
      </View>

      {/* 快捷入口 */}
      <View className='quick-actions'>
          <View className='quick-item' onClick={() => Taro.showToast({ title: '讲语音（开发中）', icon: 'none' })}>
            <View className='quick-icon voice'>
              <Mic size={32} className='icon-voice' />
            </View>
            <Text className='quick-label'>讲语音</Text>
          </View>
          <View className='quick-item' onClick={() => Taro.showToast({ title: '拍轴承（开发中）', icon: 'none' })}>
            <View className='quick-icon camera'>
              <Camera size={32} className='icon-camera' />
            </View>
            <Text className='quick-label'>拍轴承</Text>
          </View>
          <View className='quick-item' onClick={() => Taro.showToast({ title: '扫条码（开发中）', icon: 'none' })}>
            <View className='quick-icon scan'>
              <ScanBarcode size={32} className='icon-scan' />
            </View>
            <Text className='quick-label'>扫条码</Text>
          </View>
      </View>

      {/* 以下内容在简洁模式下隐藏 */}
      {!simpleMode && (
        <>
          {/* 搜索历史 */}
          {history.length > 0 && (
            <View className='history-section'>
              <View className='section-header'>
                <View className='section-title'>
                  <Clock size={16} className='icon-tertiary' />
                  <Text>搜索历史</Text>
                </View>
                <View className='clear-btn' onClick={clearHistory}>
                  <Trash2 size={14} className='icon-tertiary' />
                  <Text>清空</Text>
                </View>
              </View>
              <View className='history-tags'>
                {history.map((item, idx) => (
                  <View key={idx} className='history-tag' onClick={() => handleHistoryClick(item)}>
                    <Text>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* 热门搜索 */}
          <View className='hot-section'>
            <View className='section-header'>
              <Text className='section-title'>热门搜索</Text>
            </View>
            <View className='history-tags'>
              {['SKF', 'NSK', '6205', '6308', '轴承型号查询', '深沟球轴承'].map((item, idx) => (
                <View key={idx} className='history-tag' onClick={() => handleHistoryClick(item)}>
                  <Text>{item}</Text>
                </View>
              ))}
            </View>
          </View>
        </>
      )}

      {/* 自定义 TabBar */}
      <CustomTabBar />
    </View>
  )
}
