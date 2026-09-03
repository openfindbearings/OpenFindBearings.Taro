// 搜索结果页
// NavBar：标题居中"搜索"，左侧返回箭头（showBack）
// 调用 BFF `/api/mobile/bearings` 公开端点
import { useState, useCallback } from 'react'
import { View, Input, Text } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { Search, Package } from 'lucide-react-taro'
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

export default function SearchPage() {
  const router = useRouter()
  const [keyword, setKeyword] = useState(router.params.keyword || '')
  const [results, setResults] = useState<BearingItem[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

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
    <View className='search-page'>
      <NavBar title="搜索" showBack />

      {/* 搜索输入 */}
      <View className='search-input-wrap'>
        <Search size={16} color='#94A3B8' />
        <Input
          className='search-input'
          type='text'
          placeholder='搜索轴承型号、品牌...'
          value={keyword}
          onInput={(e) => setKeyword(e.detail.value)}
          onConfirm={() => doSearch(keyword)}
          confirmType='search'
          focus
        />
      </View>

      {loading && (
        <View className='loading'>
          <Text>搜索中...</Text>
        </View>
      )}

      {!loading && searched && results.length > 0 && (
        <View className='result-list'>
          <Text className='result-count'>共找到 {results.length} 个结果</Text>
          {results.map((item) => (
            <View
              key={item.id}
              className='result-item'
              onClick={() => Taro.navigateTo({ url: `/pages/home/search?keyword=${encodeURIComponent(item.bearingPartNumber)}` })}
            >
              <View className='result-icon'>
                <Package size={20} color='#0EA5E9' />
              </View>
              <View className='result-info'>
                <Text className='result-name'>{item.bearingPartNumber}</Text>
                <Text className='result-brand'>{item.brandName}{item.englishName ? ` · ${item.englishName}` : ''}</Text>
                <View className='result-specs'>
                  {item.dynamicLoad != null && <Text className='spec'>C: {item.dynamicLoad} kN</Text>}
                  {item.staticLoad != null && <Text className='spec'>C0: {item.staticLoad} kN</Text>}
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      {!loading && searched && results.length === 0 && (
        <View className='empty-state'>
          <Package size={48} color='#CBD5E1' />
          <Text className='empty-text'>未找到相关轴承</Text>
          <Text className='empty-hint'>请尝试其他关键词</Text>
        </View>
      )}

      {!searched && (
        <View className='empty-state'>
          <Search size={48} color='#CBD5E1' />
          <Text className='empty-text'>输入关键词开始搜索</Text>
        </View>
      )}
    </View>
  )
}
