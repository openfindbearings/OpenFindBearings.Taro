import { View, Text, Input, Button } from '@tarojs/components'
import { useState, useCallback } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { searchBearings, type Bearing } from '../../services/bearing'
import { searchMerchants, type Merchant } from '../../services/merchant'
import { useSearchStore } from '../../stores/searchStore'
import SearchResultList from './components/SearchResultList'
import HotBearings from './components/HotBearings'
import RecommendedMerchants from './components/RecommendedMerchants'
import './index.scss'

export default function HomePage() {
  const { keyword, setKeyword, searchType, setSearchType } = useSearchStore()
  const [results, setResults] = useState<(Bearing | Merchant)[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [totalCount, setTotalCount] = useState(0)

  const handleSearch = useCallback(async () => {
    if (!keyword.trim()) return
    setLoading(true)
    setHasSearched(true)
    try {
      if (searchType === 'bearing') {
        const res = await searchBearings({ keyword: keyword.trim(), page: 1, pageSize: 20 })
        setResults(res.items)
        setTotalCount(res.totalCount)
      } else {
        const res = await searchMerchants({ keyword: keyword.trim(), page: 1, pageSize: 20 })
        setResults(res.items)
        setTotalCount(res.totalCount)
      }
    } catch (e: unknown) {
      Taro.showToast({ title: (e as Error).message || '搜索失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }, [keyword, searchType])

  const handleBearingTap = (id: string) => {
    Taro.navigateTo({ url: `/pages/home/bearingDetail/index?id=${id}` })
  }

  const handleMerchantTap = (id: string) => {
    Taro.navigateTo({ url: `/pages/merchant/merchantDetail/index?id=${id}` })
  }

  return (
    <View className='home-page'>
      {/* 搜索栏 */}
      <View className='search-bar'>
        <View className='search-bar__tabs'>
          <Text
            className={`search-bar__tab ${searchType === 'bearing' ? 'active' : ''}`}
            onClick={() => setSearchType('bearing')}
          >轴承</Text>
          <Text
            className={`search-bar__tab ${searchType === 'merchant' ? 'active' : ''}`}
            onClick={() => setSearchType('merchant')}
          >商家</Text>
        </View>
        <Input
          className='search-bar__input'
          placeholder={searchType === 'bearing' ? '搜索轴承型号/品牌' : '搜索商家名称'}
          value={keyword}
          onInput={(e) => setKeyword(e.detail.value)}
          onConfirm={handleSearch}
        />
        <Button className='search-bar__btn' onClick={handleSearch}>搜索</Button>
      </View>

      {/* 搜索结果 or 默认内容 */}
      {hasSearched ? (
        <SearchResultList
          items={results}
          loading={loading}
          totalCount={totalCount}
          searchType={searchType}
          onBearingTap={handleBearingTap}
          onMerchantTap={handleMerchantTap}
        />
      ) : (
        <View className='home-content'>
          <HotBearings onItemTap={handleBearingTap} />
          <RecommendedMerchants onItemTap={handleMerchantTap} />
        </View>
      )}
    </View>
  )
}
