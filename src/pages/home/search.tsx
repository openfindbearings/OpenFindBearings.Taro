// 搜索结果页：一个关键字同时查 轴承/商家/品牌/类型 四类（顶部 Tab 切换）。
// 轴承、商家走 BFF 搜索；品牌、类型用 /home 全量列表前端按关键字过滤（数据量小）。
// 结果点击：轴承→轴承详情；商家→商家详情；品牌/类型→以该名称为关键字再搜轴承。
import { useState } from 'react'
import { View, Text, Image, Input, ScrollView } from '@tarojs/components'
import Taro, { useRouter, useDidShow } from '@tarojs/taro'
import Icon from '../../components/Icon'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../components/PageLayout'
import NavBar from '../../components/NavBar'
import { searchBearings, type Bearing } from '../../services/bearing'
import { searchMerchants, type Merchant } from '../../services/merchant'
import { getHome, type HomeRef } from '../../services/home'
import './search.scss'

definePageConfig({ disableScroll: true })

type TabKey = 'bearing' | 'merchant' | 'brand' | 'type'
const TABS: { key: TabKey; label: string }[] = [
  { key: 'bearing', label: '轴承' },
  { key: 'merchant', label: '商家' },
  { key: 'brand', label: '品牌' },
  { key: 'type', label: '类型' }
]

export default function SearchPage() {
  const router = useRouter()
  const t = useTheme()
  const fs = useFs()

  const [keyword, setKeyword] = useState(router.params.keyword || '')
  const [tab, setTab] = useState<TabKey>('bearing')
  const [bearings, setBearings] = useState<Bearing[]>([])
  const [merchants, setMerchants] = useState<Merchant[]>([])
  const [brands, setBrands] = useState<HomeRef[]>([])
  const [types, setTypes] = useState<HomeRef[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const runSearch = (kw: string) => {
    if (!kw.trim()) return
    setLoading(true)
    setSearched(true)
    const k = kw.trim()
    // 轴承、商家走后端；品牌、类型前端过滤全量列表
    searchBearings({ keyword: k }).then(r => setBearings(r?.items || [])).catch(() => setBearings([]))
    searchMerchants({ keyword: k }).then(r => setMerchants(r?.items || [])).catch(() => setMerchants([]))
    getHome().then(h => {
      const lk = k.toLowerCase()
      setBrands((h?.brands || []).filter(b => b.name.toLowerCase().includes(lk)))
      setTypes((h?.bearingTypes || []).filter(x => x.name.toLowerCase().includes(lk)))
    }).catch(() => { setBrands([]); setTypes([]) })
      .finally(() => setLoading(false))
  }

  useDidShow(() => { if (keyword) runSearch(keyword) })

  const goBearing = (id: string) => Taro.navigateTo({ url: `/pages/home/bearingDetail?id=${id}` })
  const goMerchant = (id: string) => Taro.navigateTo({ url: `/pages/merchant/merchantDetail?id=${id}` })
  // 品牌/类型 → 以该名称为关键字再搜轴承
  const searchByRef = (name: string) => { setKeyword(name); runSearch(name) }

  const resultCount = tab === 'bearing' ? bearings.length : tab === 'merchant' ? merchants.length : tab === 'brand' ? brands.length : types.length

  return (
    <PageLayout nav={<NavBar title="搜索" showBack />}>
      {/* 搜索输入行 */}
      <View className='search-input-wrap' style={{ backgroundColor: t.bgInput }}>
        <Icon name="search" size={18} color={t.textTertiary} />
        <Input
          className='search-input'
          style={{ color: t.textPrimary }}
          type='text'
          placeholder='搜索型号、品牌、商家...'
          placeholderTextColor={t.textTertiary}
          value={keyword}
          onInput={(e) => setKeyword(e.detail.value)}
          onConfirm={() => runSearch(keyword)}
          confirmType='search'
        />
      </View>

      {/* 分类 Tab */}
      <View className='search-tabs' style={{ backgroundColor: t.bgCard, borderColor: t.border }}>
        {TABS.map((tb) => (
          <View key={tb.key} className='search-tab' onClick={() => setTab(tb.key)}>
            <Text className='search-tab-text' style={{ ...fs(15), color: tab === tb.key ? t.primaryText : t.textSecondary, fontWeight: tab === tb.key ? 'bold' : 'normal' }}>
              {tb.label}
            </Text>
            {tab === tb.key && <View className='search-tab-underline' style={{ backgroundColor: t.primary }} />}
          </View>
        ))}
      </View>

      {loading && <View className='loading'><Text className='loading-text' style={{ ...fs(15), color: t.textSecondary }}>搜索中...</Text></View>}

      {/* 轴承结果 */}
      {!loading && tab === 'bearing' && (
        <View className='result-list'>
          {searched && <Text className='result-count' style={{ ...fs(13), color: t.textTertiary }}>共 {bearings.length} 个轴承</Text>}
          {bearings.map((b) => (
            <View key={b.id} className='result-item' style={{ backgroundColor: t.bgCard }} onClick={() => goBearing(b.id)}>
              <View className='result-icon' style={{ backgroundColor: t.primaryLight }}>
                {b.image2DUrl ? <Image className='result-thumb' src={b.image2DUrl} mode='aspectFit' /> : <Icon name="package" size={22} color={t.primary} />}
              </View>
              <View className='result-info'>
                <Text className='result-name' style={{ ...fs(15), color: t.textPrimary }}>{b.partNumber}</Text>
                <Text className='result-brand' style={{ ...fs(13), color: t.textSecondary }}>{b.bearingType} · {b.brandName}</Text>
              </View>
              <Icon name="chevron_right" size={18} color={t.textTertiary} />
            </View>
          ))}
        </View>
      )}

      {/* 商家结果 */}
      {!loading && tab === 'merchant' && (
        <View className='result-list'>
          {searched && <Text className='result-count' style={{ ...fs(13), color: t.textTertiary }}>共 {merchants.length} 个商家</Text>}
          {merchants.map((m) => (
            <View key={m.id} className='result-item' style={{ backgroundColor: t.bgCard }} onClick={() => goMerchant(m.id)}>
              <View className='result-icon' style={{ backgroundColor: t.primaryLight }}>
                {m.logoUrl ? <Image className='result-thumb' src={m.logoUrl} mode='aspectFill' /> : <Icon name="store" size={22} color={t.primary} />}
              </View>
              <View className='result-info'>
                <Text className='result-name' style={{ ...fs(15), color: t.textPrimary }} numberOfLines={1}>{m.name}</Text>
                <Text className='result-brand' style={{ ...fs(13), color: t.textSecondary }}>{m.productCount ?? 0} 个在售{m.isVerified ? ' · 已认证' : ''}</Text>
              </View>
              <Icon name="chevron_right" size={18} color={t.textTertiary} />
            </View>
          ))}
        </View>
      )}

      {/* 品牌结果（前端过滤） */}
      {!loading && tab === 'brand' && (
        <View className='result-list'>
          {brands.map((b) => (
            <View key={b.id} className='ref-row' style={{ backgroundColor: t.bgCard }} onClick={() => searchByRef(b.name)}>
              <Text className='ref-name' style={{ ...fs(15), color: t.textPrimary }}>{b.name}</Text>
              <Icon name="chevron_right" size={18} color={t.textTertiary} />
            </View>
          ))}
        </View>
      )}

      {/* 类型结果（前端过滤） */}
      {!loading && tab === 'type' && (
        <View className='result-list'>
          {types.map((x) => (
            <View key={x.id} className='ref-row' style={{ backgroundColor: t.bgCard }} onClick={() => searchByRef(x.name)}>
              <Text className='ref-name' style={{ ...fs(15), color: t.textPrimary }}>{x.name}</Text>
              <Icon name="chevron_right" size={18} color={t.textTertiary} />
            </View>
          ))}
        </View>
      )}

      {/* 空态 */}
      {!loading && searched && resultCount === 0 && (
        <View className='empty-state'>
          <Icon name="search" size={48} color={t.border} />
          <Text className='empty-text' style={{ ...fs(15), color: t.textSecondary }}>未找到相关结果</Text>
          <Text className='empty-hint' style={{ ...fs(13), color: t.textTertiary }}>请尝试其他关键词</Text>
        </View>
      )}
    </PageLayout>
  )
}
