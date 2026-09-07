// 搜索结果页
// v1.7.0 度量重构：接入 PageLayout（删 rnHeight hack），输入行/结果卡走 dp token
// NavBar：标题居中"搜索"，左侧返回箭头（showBack）
// 调用 BFF `/mobile/api/mobile/bearings` 公开端点
import { useState, useCallback } from 'react'
import Icon from '../../components/Icon'
import { View, Input, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../components/PageLayout'
import NavBar from '../../components/NavBar'
import './search.scss'

const BFF_BASE = '/mobile'

interface BearingItem {
  id: string
  bearingPartNumber: string
  brandName: string
  englishName: string | null
  dynamicLoad: number | null
  staticLoad: number | null
}

// 编译期配置：禁用外层 ScrollView，滚动由 PageLayout 内部统一提供
definePageConfig({ disableScroll: true })

export default function SearchPage() {
  const router = useRouter()
  const [keyword, setKeyword] = useState(router.params.keyword || '')
  const [results, setResults] = useState<BearingItem[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  // 主题色板（结果图标/卡片/文字随模式）+ 全局字号
  const t = useTheme()
  const fs = useFs()

  const doSearch = useCallback(async (kw: string) => {
    if (!kw.trim()) return
    setLoading(true)
    setSearched(true)
    try {
      const res = await Taro.request({
        url: `${BFF_BASE}/api/mobile/bearings?keyword=${encodeURIComponent(kw.trim())}&page=1&pageSize=20`,
        method: 'GET'
      })
      if (res.statusCode === 200 && res.data) {
        const data = res.data as any
        setResults(data.items || data.data?.items || [])
      } else {
        setResults([])
      }
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  // 首次进入自动搜索
  useState(() => {
    const kw = router.params.keyword
    if (kw) doSearch(kw)
  })

  return (
    <PageLayout nav={<NavBar title="搜索" showBack />}>
      {/* 搜索输入行 */}
      <View className='search-input-wrap' style={{ backgroundColor: t.bgInput }}>
        <Icon name="search" size={18} color={t.textTertiary} />
        <Input
          className='search-input'
          style={{ color: t.textPrimary }}
          type='text'
          placeholder='搜索轴承型号、品牌...'
          placeholderTextColor={t.textTertiary}
          value={keyword}
          onInput={(e) => setKeyword(e.detail.value)}
          onConfirm={() => doSearch(keyword)}
          confirmType='search'
          focus
        />
      </View>

      {loading && (
        <View className='loading'>
          <Text className='loading-text' style={{ ...fs(15), color: t.textSecondary }}>搜索中...</Text>
        </View>
      )}

      {!loading && searched && results.length > 0 && (
        <View className='result-list'>
          <Text className='result-count' style={{ ...fs(13), color: t.textTertiary }}>共找到 {results.length} 个结果</Text>
          {results.map((item) => (
            <View
              key={item.id}
              className='result-item'
              style={{ backgroundColor: t.bgCard }}
              onClick={() => Taro.navigateTo({ url: `/pages/home/search?keyword=${encodeURIComponent(item.bearingPartNumber)}` })}
            >
              <View className='result-icon' style={{ backgroundColor: t.primaryLight }}>
                <Icon name="package" size={22} color={t.primary} />
              </View>
              <View className='result-info'>
                <Text className='result-name' style={{ ...fs(15), color: t.textPrimary }}>{item.bearingPartNumber}</Text>
                <Text className='result-brand' style={{ ...fs(13), color: t.textSecondary }}>{item.brandName}{item.englishName ? ` · ${item.englishName}` : ''}</Text>
                <View className='result-specs'>
                  {item.dynamicLoad != null && <Text className='spec' style={{ ...fs(12), color: t.textTertiary }}>C: {item.dynamicLoad} kN</Text>}
                  {item.staticLoad != null && <Text className='spec' style={{ ...fs(12), color: t.textTertiary }}>C0: {item.staticLoad} kN</Text>}
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      {!loading && searched && results.length === 0 && (
        <View className='empty-state'>
          <Icon name="package" size={48} color={t.border} />
          <Text className='empty-text' style={{ ...fs(15), color: t.textSecondary }}>未找到相关轴承</Text>
          <Text className='empty-hint' style={{ ...fs(13), color: t.textTertiary }}>请尝试其他关键词</Text>
        </View>
      )}

      {!searched && (
        <View className='empty-state'>
          <Icon name="search" size={48} color={t.border} />
          <Text className='empty-text' style={{ ...fs(15), color: t.textSecondary }}>输入关键词开始搜索</Text>
        </View>
      )}
    </PageLayout>
  )
}
