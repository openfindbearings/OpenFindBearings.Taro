// 搜索结果页：一个关键字同时查 轴承/商家/品牌/类型 四类（顶部 Tab 切换）。
// 轴承、商家走 BFF 搜索；品牌、类型用 /home 全量列表前端按关键字过滤（数据量小）。
// 结果点击：轴承→轴承详情；商家→商家详情；品牌/类型→以该名称为关键字再搜轴承。
import { useState, useRef } from 'react'
import { View, Text, Image, Input, ScrollView } from '@tarojs/components'
import Taro, { useRouter, useDidShow } from '@tarojs/taro'
import Icon from '../../components/Icon'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import { searchBearings, type Bearing } from '../../services/bearing'
import { searchMerchants, type Merchant } from '../../services/merchant'
import { getHome, type HomeRef } from '../../services/home'
import { usableImage } from '../../services/config'
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
  // 改动说明：偶发网络/服务瞬时失败会被静默吞成空结果，加错误态以显示"重试"；reqId 防并发覆盖
  const [searchError, setSearchError] = useState(false)
  const reqIdRef = useRef(0)

  // 带重试的取数：仅对网络层错误重试 2 次（间隔 300ms）；HTTP 状态错误(4xx/5xx/鉴权)不重试，
  // 改动说明：对 429/400 重试只会加剧限流/无意义，直接失败返回 null。
  const fetchWithRetry = async <T,>(fn: () => Promise<T>, retries = 2): Promise<T | null> => {
    for (let i = 0; i <= retries; i++) {
      try {
        return await fn()
      } catch (e: any) {
        const msg: string = e?.message || ''
        if (msg.startsWith('HTTP ') || msg === 'UNAUTHORIZED') return null
        if (i < retries) await new Promise((r) => setTimeout(r, 300))
      }
    }
    return null
  }

  const runSearch = async (kw: string) => {
    if (!kw.trim()) return
    const myId = ++reqIdRef.current
    setLoading(true)
    setSearchError(false)
    setSearched(true)
    const k = kw.trim()
    const lk = k.toLowerCase()
    // 轴承、商家走后端（带重试）；品牌、类型前端过滤全量列表。并发取齐后按命中数自动选中最多的 Tab。
    const [bRes, mRes, hRes] = await Promise.all([
      fetchWithRetry(() => searchBearings({ keyword: k })),
      fetchWithRetry(() => searchMerchants({ keyword: k })),
      fetchWithRetry(() => getHome())
    ])
    // 已有更新的搜索发起，丢弃本次过期结果，避免相互覆盖
    if (myId !== reqIdRef.current) return
    const b = bRes?.items || []
    const m = mRes?.items || []
    const br = (hRes?.brands || []).filter((x) => x.name.toLowerCase().includes(lk))
    const ty = (hRes?.bearingTypes || []).filter((x) => x.name.toLowerCase().includes(lk))
    setBearings(b)
    setMerchants(m)
    setBrands(br)
    setTypes(ty)
    // 轴承与商家接口都失败（返回 null）且无任何结果 → 判定为加载失败，给出重试入口
    if (bRes === null && mRes === null && b.length === 0 && m.length === 0) {
      setSearchError(true)
    } else {
      // 改动说明：搜索完成后自动切到命中数最多的分类（并列时按 轴承>商家>品牌>类型 优先）
      const counts: { key: TabKey; n: number }[] = [
        { key: 'bearing', n: b.length },
        { key: 'merchant', n: m.length },
        { key: 'brand', n: br.length },
        { key: 'type', n: ty.length }
      ]
      const best = counts.reduce((a, c) => (c.n > a.n ? c : a), counts[0])
      if (best.n > 0) setTab(best.key)
    }
    setLoading(false)
  }

  useDidShow(() => { if (keyword) runSearch(keyword) })

  const goBearing = (id: string) => Taro.navigateTo({ url: `/pages/home/bearingDetail?id=${id}` })
  const goMerchant = (id: string) => Taro.navigateTo({ url: `/pages/merchant/merchantDetail?id=${id}` })
  // 品牌/类型 → 以该名称为关键字再搜轴承
  const searchByRef = (name: string) => { setKeyword(name); runSearch(name) }

  const resultCount = tab === 'bearing' ? bearings.length : tab === 'merchant' ? merchants.length : tab === 'brand' ? brands.length : types.length

  // 各分类命中数（搜索完成后显示在 Tab 标签上）
  const tabCounts: Record<TabKey, number> = {
    bearing: bearings.length, merchant: merchants.length, brand: brands.length, type: types.length
  }

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
              {searched ? `${tb.label} ${tabCounts[tb.key]}` : tb.label}
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
                {usableImage(b.image2DUrl) ? <Image className='result-thumb' src={usableImage(b.image2DUrl)} mode='aspectFit' /> : <Icon name="package" size={22} color={t.primary} />}
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
                {usableImage(m.logoUrl) ? <Image className='result-thumb' src={usableImage(m.logoUrl)} mode='aspectFill' /> : <Icon name="store" size={22} color={t.primary} />}
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

      {/* 空态：区分"加载失败可重试" 与 "确实无结果" */}
      {!loading && searched && resultCount === 0 && (
        <View className='empty-state'>
          <Icon name={searchError ? 'alert-circle' : 'search'} size={48} color={t.border} />
          <Text className='empty-text' style={{ ...fs(15), color: t.textSecondary }}>
            {searchError ? '加载失败，请重试' : '未找到相关结果'}
          </Text>
          <Text className='empty-hint' style={{ ...fs(13), color: t.textTertiary }}>
            {searchError ? '网络或服务暂时不可用' : '请尝试其他关键词'}
          </Text>
          {searchError && (
            <View className='retry-btn' style={{ backgroundColor: t.primary }} onClick={() => runSearch(keyword)}>
              <Text className='retry-btn-text' style={{ ...fs(15), color: t.textOnPrimary }}>重新加载</Text>
            </View>
          )}
        </View>
      )}
    </PageLayout>
  )
}
