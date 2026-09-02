import { useState, useCallback } from 'react'
import { View, Input, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { Search, Mic, Camera, Scan, ChevronRight, Clock, Trash2 } from 'lucide-react-taro'
import './index.scss'

const STORAGE_KEY = 'search_history'
const MAX_HISTORY = 10

export default function HomePage() {
  const [keyword, setKeyword] = useState('')
  const [history, setHistory] = useState<string[]>([])

  useDidShow(() => {
    const saved = Taro.getStorageSync(STORAGE_KEY)
    if (saved) setHistory(JSON.parse(saved))
  })

  const saveHistory = useCallback((kw: string) => {
    if (!kw.trim()) return
    const updated = [kw, ...history.filter(h => h !== kw)].slice(0, MAX_HISTORY)
    setHistory(updated)
    Taro.setStorageSync(STORAGE_KEY, JSON.stringify(updated))
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
          Taro.removeStorageSync(STORAGE_KEY)
        }
      }
    })
  }, [])

  return (
    <View className='home'>
      {/* 搜索栏 */}
      <View className='search-bar'>
        <View className='search-input-wrap'>
          <Search size={18} color='#94A3B8' />
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
            <View className='action-icon' onClick={() => Taro.showToast({ title: '语音搜索（开发中）', icon: 'none' })}>
              <Mic size={18} color='#64748B' />
            </View>
            <View className='action-icon' onClick={() => Taro.showToast({ title: '拍照搜索（开发中）', icon: 'none' })}>
              <Camera size={18} color='#64748B' />
            </View>
          </View>
        </View>
      </View>

      {/* 快捷入口 */}
      <View className='quick-actions'>
        <View className='quick-item' onClick={() => Taro.showToast({ title: '语音搜索（开发中）', icon: 'none' })}>
          <View className='quick-icon voice'>
            <Mic size={24} color='#2563EB' />
          </View>
          <Text className='quick-label'>语音搜索</Text>
        </View>
        <View className='quick-item' onClick={() => Taro.showToast({ title: '拍照识物（开发中）', icon: 'none' })}>
          <View className='quick-icon camera'>
            <Camera size={24} color='#16A34A' />
          </View>
          <Text className='quick-label'>拍照识物</Text>
        </View>
        <View className='quick-item' onClick={() => Taro.showToast({ title: '扫一扫（开发中）', icon: 'none' })}>
          <View className='quick-icon scan'>
            <Scan size={24} color='#EA580C' />
          </View>
          <Text className='quick-label'>扫一扫</Text>
        </View>
      </View>

      {/* 搜索历史 */}
      {history.length > 0 && (
        <View className='history-section'>
          <View className='section-header'>
            <View className='section-title'>
              <Clock size={16} color='#94A3B8' />
              <Text>搜索历史</Text>
            </View>
            <View className='clear-btn' onClick={clearHistory}>
              <Trash2 size={14} color='#94A3B8' />
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

      {/* 底部提示 */}
      <View className='footer-tip'>
        <Text>输入轴承型号或品牌开始搜索</Text>
      </View>
    </View>
  )
}
