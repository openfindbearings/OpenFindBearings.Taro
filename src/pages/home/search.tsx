// 搜索结果页：单关键字查 轴承/商家/品牌/类型 四类（顶部 Tab）。
// 轴承 Tab 采用主流结果页范式：排序栏（综合/型号/内径/外径/宽度/热度，点击切换升降序）+ 尺寸筛选面板 + 已选筛选 chips。
// 品牌/类型 Tab 点击 → 切到轴承 Tab 并挂上该品牌/类型筛选（chip 可清除），不另开页。
// 数据：轴承/商家走 BFF 搜索；品牌/类型用 /home 全量列表前端过滤。
import { useState, useRef } from 'react'
import { View, Text, Image, Input, ScrollView } from '@tarojs/components'
import Taro, { useRouter, useDidShow } from '@tarojs/taro'
import Icon from '../../components/Icon'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import { searchBearings, type Bearing, type BearingSearchParams } from '../../services/bearing'
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

// 排序栏选项（对应 API sortBy；点击已选中的则切换升降序）
const SORTS: { key: NonNullable<BearingSearchParams['sortBy']>; label: string; defaultDesc?: boolean }[] = [
  { key: 'partnumber', label: '型号' },
  { key: 'innerdiameter', label: '内径' },
  { key: 'outerdiameter', label: '外径' },
  { key: 'width', label: '宽度' },
  { key: 'viewcount', label: '热度', defaultDesc: true }
]

const PAGE_SIZE = 20

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
  const [searchError, setSearchError] = useState(false)
  const reqIdRef = useRef(0)

  // 轴承 Tab 的排序/筛选状态
  const [sortBy, setSortBy] = useState<NonNullable<BearingSearchParams['sortBy']>>('partnumber')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [showFilter, setShowFilter] = useState(false)
  const [brandFilter, setBrandFilter] = useState<{ id: string; name: string } | null>(null)
  const [typeFilter, setTypeFilter] = useState<{ id: string; name: string } | null>(null)
  const [sizeInput, setSizeInput] = useState({ minIn: '', maxIn: '', minOut: '', maxOut: '', minW: '', maxW: '' })
  const [sizeFilter, setSizeFilter] = useState<{ minIn?: number; maxIn?: number; minOut?: number; maxOut?: number; minW?: number; maxW?: number }>({})
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  // 商家 Tab 的排序/筛选状态（综合=认证优先默认 / 在售数 / 名称；仅已认证开关）
  const [mSortBy, setMSortBy] = useState<'name' | 'productcount' | undefined>(undefined)
  const [mSortOrder, setMSortOrder] = useState<'asc' | 'desc'>('asc')
  const [mVerifiedOnly, setMVerifiedOnly] = useState(false)

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

  // 组装轴承查询参数（关键词 + 品牌/类型/尺寸筛选 + 排序）
  const buildBearingParams = (p: number): BearingSearchParams => ({
    keyword: keyword.trim() || undefined,
    brandId: brandFilter?.id,
    bearingTypeId: typeFilter?.id,
    sortBy,
    sortOrder,
    minInnerDiameter: sizeFilter.minIn,
    maxInnerDiameter: sizeFilter.maxIn,
    minOuterDiameter: sizeFilter.minOut,
    maxOuterDiameter: sizeFilter.maxOut,
    minWidth: sizeFilter.minW,
    maxWidth: sizeFilter.maxW,
    page: p,
    pageSize: PAGE_SIZE
  })

  // 加载轴承列表（reset=true 覆盖，false 追加下一页）
  const loadBearings = async (reset: boolean) => {
    const p = reset ? 1 : page + 1
    const myId = reqIdRef.current
    const res = await fetchWithRetry(() => searchBearings(buildBearingParams(p)))
    if (myId !== reqIdRef.current) return
    const items = res?.items || []
    const total = res?.totalCount ?? 0
    setBearings((prev) => (reset ? items : [...prev, ...items]))
    setPage(p)
    setHasMore(p * PAGE_SIZE < total)
    if (reset) {
      // 无关键词且无任何筛选时不视为错误（用户可能只是清了输入）
      if (res === null && !keyword.trim() && !brandFilter && !typeFilter) setSearchError(true)
      else setSearchError(false)
    }
  }

  // 关键词搜索：并发取 轴承/商家/品牌/类型，完成后自动选命中最多的 Tab
  const runSearch = async (kw: string) => {
    if (!kw.trim()) return
    const myId = ++reqIdRef.current
    setLoading(true)
    setSearchError(false)
    setSearched(true)
    const k = kw.trim()
    const lk = k.toLowerCase()
    const [bRes, mRes, hRes] = await Promise.all([
      fetchWithRetry(() => searchBearings(buildBearingParams(1))),
      fetchWithRetry(() => searchMerchants({ keyword: k })),
      fetchWithRetry(() => getHome())
    ])
    if (myId !== reqIdRef.current) return
    const b = bRes?.items || []
    const m = mRes?.items || []
    const br = (hRes?.brands || []).filter((x) => x.name.toLowerCase().includes(lk))
    const ty = (hRes?.bearingTypes || []).filter((x) => x.name.toLowerCase().includes(lk))
    setBearings(b)
    setMerchants(m)
    setBrands(br)
    setTypes(ty)
    setPage(1)
    setHasMore(b.length < (bRes?.totalCount ?? 0))
    if (bRes === null && mRes === null && b.length === 0 && m.length === 0) {
      setSearchError(true)
    } else {
      setSearchError(false)
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

  // 排序：点击已选字段切换升降序，否则选中新字段（热度默认降序）
  const handleSort = (key: NonNullable<BearingSearchParams['sortBy']>, defaultDesc?: boolean) => {
    let order: 'asc' | 'desc'
    if (sortBy === key) order = sortOrder === 'asc' ? 'desc' : 'asc'
    else order = defaultDesc ? 'desc' : 'asc'
    setSortBy(key)
    setSortOrder(order)
    setLoading(true)
    const myId = ++reqIdRef.current
    fetchWithRetry(() => searchBearings({ ...buildBearingParams(1), sortBy: key, sortOrder: order })).then((res) => {
      if (myId !== reqIdRef.current) return
      const items = res?.items || []
      setBearings(items)
      setPage(1)
      setHasMore(items.length < (res?.totalCount ?? 0))
      setLoading(false)
    })
  }

  // 应用尺寸筛选
  const applySizeFilter = () => {
    const num = (s: string) => (s.trim() === '' ? undefined : Number(s))
    setSizeFilter({
      minIn: num(sizeInput.minIn), maxIn: num(sizeInput.maxIn),
      minOut: num(sizeInput.minOut), maxOut: num(sizeInput.maxOut),
      minW: num(sizeInput.minW), maxW: num(sizeInput.maxW)
    })
    setShowFilter(false)
    setLoading(true)
    const myId = ++reqIdRef.current
    const sf = {
      minIn: num(sizeInput.minIn), maxIn: num(sizeInput.maxIn),
      minOut: num(sizeInput.minOut), maxOut: num(sizeInput.maxOut),
      minW: num(sizeInput.minW), maxW: num(sizeInput.maxW)
    }
    fetchWithRetry(() => searchBearings({
      keyword: keyword.trim() || undefined, brandId: brandFilter?.id, bearingTypeId: typeFilter?.id,
      sortBy, sortOrder, minInnerDiameter: sf.minIn, maxInnerDiameter: sf.maxIn,
      minOuterDiameter: sf.minOut, maxOuterDiameter: sf.maxOut, minWidth: sf.minW, maxWidth: sf.maxW,
      page: 1, pageSize: PAGE_SIZE
    })).then((res) => {
      if (myId !== reqIdRef.current) return
      const items = res?.items || []
      setBearings(items); setPage(1); setHasMore(items.length < (res?.totalCount ?? 0)); setLoading(false)
    })
  }

  const clearSizeFilter = () => {
    setSizeFilter({}); setSizeInput({ minIn: '', maxIn: '', minOut: '', maxOut: '', minW: '', maxW: '' })
    loadBearings(true)
  }

  // 品牌/类型 Tab 点击 → 挂筛选并切到轴承 Tab
  const applyBrand = (b: HomeRef) => { setBrandFilter({ id: b.id, name: b.name }); setTypeFilter(null); setTab('bearing'); setLoading(true); const myId = ++reqIdRef.current; fetchWithRetry(() => searchBearings({ keyword: keyword.trim() || undefined, brandId: b.id, sortBy, sortOrder, ...sizeToParams(sizeFilter), page: 1, pageSize: PAGE_SIZE })).then((r) => { if (myId !== reqIdRef.current) return; const it = r?.items || []; setBearings(it); setPage(1); setHasMore(it.length < (r?.totalCount ?? 0)); setLoading(false) }) }
  const applyType = (x: HomeRef) => { setTypeFilter({ id: x.id, name: x.name }); setBrandFilter(null); setTab('bearing'); setLoading(true); const myId = ++reqIdRef.current; fetchWithRetry(() => searchBearings({ keyword: keyword.trim() || undefined, bearingTypeId: x.id, sortBy, sortOrder, ...sizeToParams(sizeFilter), page: 1, pageSize: PAGE_SIZE })).then((r) => { if (myId !== reqIdRef.current) return; const it = r?.items || []; setBearings(it); setPage(1); setHasMore(it.length < (r?.totalCount ?? 0)); setLoading(false) }) }

  const clearBrand = () => { setBrandFilter(null); loadBearings(true) }
  const clearType = () => { setTypeFilter(null); loadBearings(true) }

  // 重新拉取商家列表（按当前 keyword + 排序 + 认证筛选）
  const reloadMerchants = (over?: { sortBy?: 'name' | 'productcount'; sortOrder?: 'asc' | 'desc'; verifiedOnly?: boolean }) => {
    setLoading(true)
    const myId = ++reqIdRef.current
    const sb = over && 'sortBy' in over ? over.sortBy : mSortBy
    const so = over && 'sortOrder' in over ? over.sortOrder : mSortOrder
    const vo = over && 'verifiedOnly' in over ? over.verifiedOnly : mVerifiedOnly
    fetchWithRetry(() => searchMerchants({ keyword: keyword.trim() || undefined, sortBy: sb, sortOrder: so, verifiedOnly: vo || undefined, page: 1, pageSize: PAGE_SIZE })).then((r) => {
      if (myId !== reqIdRef.current) return
      setMerchants(r?.items || [])
      setLoading(false)
    })
  }

  // 商家排序：点击切换升降序（综合=清空 sortBy 回认证优先）
  const handleMSort = (key?: 'name' | 'productcount') => {
    if (!key) { setMSortBy(undefined); setMSortOrder('asc'); reloadMerchants({ sortBy: undefined, sortOrder: 'asc' }); return }
    let order: 'asc' | 'desc'
    if (mSortBy === key) order = mSortOrder === 'asc' ? 'desc' : 'asc'
    else order = key === 'productcount' ? 'desc' : 'asc'
    setMSortBy(key); setMSortOrder(order)
    reloadMerchants({ sortBy: key, sortOrder: order })
  }

  const toggleMVerified = () => { const v = !mVerifiedOnly; setMVerifiedOnly(v); reloadMerchants({ verifiedOnly: v }) }

  const loadMore = () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    loadBearings(false).finally(() => setLoadingMore(false))
  }

  const goBearing = (id: string) => Taro.navigateTo({ url: `/pages/home/bearingDetail?id=${id}` })
  const goMerchant = (id: string) => Taro.navigateTo({ url: `/pages/merchant/merchantDetail?id=${id}` })

  const tabCounts: Record<TabKey, number> = { bearing: bearings.length, merchant: merchants.length, brand: brands.length, type: types.length }
  const resultCount = tabCounts[tab]
  const hasAnyBearingFilter = !!(brandFilter || typeFilter || sizeFilter.minIn != null || sizeFilter.maxIn != null || sizeFilter.minOut != null || sizeFilter.maxOut != null || sizeFilter.minW != null || sizeFilter.maxW != null)

  return (
    <PageLayout nav={<NavBar title="搜索" showBack />}>
      {/* 搜索输入行 */}
      <View className='search-input-wrap' style={{ backgroundColor: t.bgInput }}>
        <Icon name="search" size={18} color={t.textTertiary} />
        <Input
          className='search-input'
          style={{ color: t.textPrimary }}
          type='text'
          placeholder='搜索型号、品牌、类型、商家...'
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

      {/* ===== 轴承 Tab：排序栏 + 筛选 chips + 尺寸筛选面板 + 列表 ===== */}
      {tab === 'bearing' && (
        <View>
          {/* 排序栏 */}
          <View className='sort-bar' style={{ backgroundColor: t.bgCard, borderColor: t.border }}>
            <View className='sort-item' onClick={() => handleSort('partnumber')}>
              <Text style={{ ...fs(13), color: sortBy === 'partnumber' ? t.primaryText : t.textSecondary, fontWeight: sortBy === 'partnumber' ? 'bold' : 'normal' }}>综合</Text>
            </View>
            {SORTS.slice(1).map((s) => (
              <View key={s.key} className='sort-item' onClick={() => handleSort(s.key, s.defaultDesc)}>
                <Text style={{ ...fs(13), color: sortBy === s.key ? t.primaryText : t.textSecondary, fontWeight: sortBy === s.key ? 'bold' : 'normal' }}>{s.label}</Text>
                {sortBy === s.key && <Text style={{ ...fs(11), color: t.primaryText }}>{sortOrder === 'asc' ? ' ↑' : ' ↓'}</Text>}
              </View>
            ))}
            <View className='sort-filter-btn' onClick={() => setShowFilter((v) => !v)}>
              <Icon name="filter" size={15} color={hasAnyBearingFilter ? t.primaryText : t.textSecondary} />
              <Text style={{ ...fs(13), color: hasAnyBearingFilter ? t.primaryText : t.textSecondary }}>筛选</Text>
            </View>
          </View>

          {/* 已选筛选 chips */}
          {hasAnyBearingFilter && (
            <View className='filter-chips'>
              {brandFilter && (
                <View className='chip' style={{ backgroundColor: t.primaryLight }} onClick={clearBrand}>
                  <Text className='chip-text' style={{ ...fs(12), color: t.primaryText }}>品牌:{brandFilter.name}</Text>
                  <Icon name="x" size={12} color={t.primaryText} />
                </View>
              )}
              {typeFilter && (
                <View className='chip' style={{ backgroundColor: t.primaryLight }} onClick={clearType}>
                  <Text className='chip-text' style={{ ...fs(12), color: t.primaryText }}>类型:{typeFilter.name}</Text>
                  <Icon name="x" size={12} color={t.primaryText} />
                </View>
              )}
              {(sizeFilter.minIn != null || sizeFilter.maxIn != null) && (
                <View className='chip' style={{ backgroundColor: t.primaryLight }} onClick={clearSizeFilter}>
                  <Text className='chip-text' style={{ ...fs(12), color: t.primaryText }}>内径:{fmtRange(sizeFilter.minIn, sizeFilter.maxIn)}</Text>
                </View>
              )}
            </View>
          )}

          {/* 尺寸筛选面板（展开） */}
          {showFilter && (
            <View className='filter-panel' style={{ backgroundColor: t.bgCard }}>
              <Text className='filter-panel-title' style={{ ...fs(14), color: t.textPrimary }}>尺寸范围 (mm)</Text>
              <FilterRange label="内径" t={t} fs={fs} min={sizeInput.minIn} max={sizeInput.maxIn} onMin={(v) => setSizeInput((s) => ({ ...s, minIn: v }))} onMax={(v) => setSizeInput((s) => ({ ...s, maxIn: v }))} />
              <FilterRange label="外径" t={t} fs={fs} min={sizeInput.minOut} max={sizeInput.maxOut} onMin={(v) => setSizeInput((s) => ({ ...s, minOut: v }))} onMax={(v) => setSizeInput((s) => ({ ...s, maxOut: v }))} />
              <FilterRange label="宽度" t={t} fs={fs} min={sizeInput.minW} max={sizeInput.maxW} onMin={(v) => setSizeInput((s) => ({ ...s, minW: v }))} onMax={(v) => setSizeInput((s) => ({ ...s, maxW: v }))} />
              <View className='filter-panel-actions'>
                <View className='filter-reset' style={{ borderColor: t.border }} onClick={clearSizeFilter}>
                  <Text style={{ ...fs(14), color: t.textSecondary }}>重置</Text>
                </View>
                <View className='filter-apply' style={{ backgroundColor: t.primary }} onClick={applySizeFilter}>
                  <Text style={{ ...fs(14), color: t.textOnPrimary, fontWeight: 'bold' }}>确定</Text>
                </View>
              </View>
            </View>
          )}

          {/* 轴承列表 */}
          {loading && <View className='loading'><Text className='loading-text' style={{ ...fs(15), color: t.textSecondary }}>加载中...</Text></View>}
          {!loading && (
            <View className='result-list'>
              {searched && <Text className='result-count' style={{ ...fs(13), color: t.textTertiary }}>共 {bearings.length} 条{hasMore ? '（可加载更多）' : ''}</Text>}
              {bearings.map((b) => (
                <View key={b.id} className='result-item' style={{ backgroundColor: t.bgCard }} onClick={() => goBearing(b.id)}>
                  <View className='result-icon' style={{ backgroundColor: t.primaryLight }}>
                    {usableImage(b.image2DUrl) ? <Image className='result-thumb' src={usableImage(b.image2DUrl)} mode='aspectFit' /> : <Icon name="package" size={22} color={t.primary} />}
                  </View>
                  <View className='result-info'>
                    <Text className='result-name' style={{ ...fs(15), color: t.textPrimary }}>{b.partNumber}</Text>
                    <Text className='result-brand' style={{ ...fs(13), color: t.textSecondary }}>{b.bearingType} · {b.brandName}</Text>
                    <Text className='result-specs-inline' style={{ ...fs(12), color: t.textTertiary }}>d {b.innerDiameter} · D {b.outerDiameter} · B {b.width}</Text>
                  </View>
                  <Icon name="chevron_right" size={18} color={t.textTertiary} />
                </View>
              ))}
              {hasMore && (
                <View className='load-more' onClick={loadMore}>
                  <Text style={{ ...fs(14), color: t.primaryText }}>{loadingMore ? '加载中...' : '加载更多'}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* ===== 商家 Tab：排序栏（综合/在售数/名称）+ 仅已认证 ===== */}
      {tab === 'merchant' && (
        <View>
          <View className='sort-bar' style={{ backgroundColor: t.bgCard, borderColor: t.border }}>
            <View className='sort-item' onClick={() => handleMSort(undefined)}>
              <Text style={{ ...fs(13), color: !mSortBy ? t.primaryText : t.textSecondary, fontWeight: !mSortBy ? 'bold' : 'normal' }}>综合</Text>
            </View>
            <View className='sort-item' onClick={() => handleMSort('productcount')}>
              <Text style={{ ...fs(13), color: mSortBy === 'productcount' ? t.primaryText : t.textSecondary, fontWeight: mSortBy === 'productcount' ? 'bold' : 'normal' }}>在售数</Text>
              {mSortBy === 'productcount' && <Text style={{ ...fs(11), color: t.primaryText }}>{mSortOrder === 'asc' ? ' ↑' : ' ↓'}</Text>}
            </View>
            <View className='sort-item' onClick={() => handleMSort('name')}>
              <Text style={{ ...fs(13), color: mSortBy === 'name' ? t.primaryText : t.textSecondary, fontWeight: mSortBy === 'name' ? 'bold' : 'normal' }}>名称</Text>
              {mSortBy === 'name' && <Text style={{ ...fs(11), color: t.primaryText }}>{mSortOrder === 'asc' ? ' ↑' : ' ↓'}</Text>}
            </View>
            <View className='sort-filter-btn' onClick={toggleMVerified}>
              <Icon name={mVerifiedOnly ? 'check-circle' : 'circle'} size={16} color={mVerifiedOnly ? t.primaryText : t.textSecondary} />
              <Text style={{ ...fs(13), color: mVerifiedOnly ? t.primaryText : t.textSecondary }}>仅已认证</Text>
            </View>
          </View>

          <View className='result-list'>
            {loading && <View className='loading'><Text className='loading-text' style={{ ...fs(15), color: t.textSecondary }}>搜索中...</Text></View>}
            {!loading && merchants.map((m) => (
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
        </View>
      )}

      {/* ===== 品牌 Tab（点击挂品牌筛选） ===== */}
      {tab === 'brand' && (
        <View className='result-list'>
          {brands.map((b) => (
            <View key={b.id} className='ref-row' style={{ backgroundColor: t.bgCard }} onClick={() => applyBrand(b)}>
              <Text className='ref-name' style={{ ...fs(15), color: t.textPrimary }}>{b.name}</Text>
              <Text className='ref-hint' style={{ ...fs(12), color: t.textTertiary }}>看该品牌轴承</Text>
              <Icon name="chevron_right" size={18} color={t.textTertiary} />
            </View>
          ))}
        </View>
      )}

      {/* ===== 类型 Tab（点击挂类型筛选） ===== */}
      {tab === 'type' && (
        <View className='result-list'>
          {types.map((x) => (
            <View key={x.id} className='ref-row' style={{ backgroundColor: t.bgCard }} onClick={() => applyType(x)}>
              <Text className='ref-name' style={{ ...fs(15), color: t.textPrimary }}>{x.name}</Text>
              <Text className='ref-hint' style={{ ...fs(12), color: t.textTertiary }}>看该类型轴承</Text>
              <Icon name="chevron_right" size={18} color={t.textTertiary} />
            </View>
          ))}
        </View>
      )}

      {/* 空态 */}
      {!loading && searched && tab === 'bearing' && resultCount === 0 && (
        <View className='empty-state'>
          <Icon name={searchError ? 'alert-circle' : 'search'} size={48} color={t.border} />
          <Text className='empty-text' style={{ ...fs(15), color: t.textSecondary }}>{searchError ? '加载失败，请重试' : '未找到相关结果'}</Text>
          <Text className='empty-hint' style={{ ...fs(13), color: t.textTertiary }}>{searchError ? '网络或服务暂时不可用' : '试试型号、品牌或类型关键词'}</Text>
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

// 尺寸范围参数转 searchBearings 入参
function sizeToParams(sf: { minIn?: number; maxIn?: number; minOut?: number; maxOut?: number; minW?: number; maxW?: number }) {
  return { minInnerDiameter: sf.minIn, maxInnerDiameter: sf.maxIn, minOuterDiameter: sf.minOut, maxOuterDiameter: sf.maxOut, minWidth: sf.minW, maxWidth: sf.maxW }
}

// 尺寸范围文案
function fmtRange(min?: number, max?: number) {
  if (min != null && max != null) return `${min}-${max}`
  if (min != null) return `≥${min}`
  if (max != null) return `≤${max}`
  return ''
}

// 单个尺寸区间输入行（内径/外径/宽度）
function FilterRange({ label, t, fs, min, max, onMin, onMax }: any) {
  return (
    <View className='filter-range-row'>
      <Text className='filter-range-label' style={{ ...fs(13), color: t.textSecondary }}>{label}</Text>
      <Input className='filter-range-input' style={{ color: t.textPrimary, backgroundColor: t.bgInput }} type='digit' placeholder='最小' placeholderTextColor={t.textTertiary} value={min} onInput={(e: any) => onMin(e.detail.value)} />
      <Text className='filter-range-dash' style={{ ...fs(13), color: t.textTertiary }}>—</Text>
      <Input className='filter-range-input' style={{ color: t.textPrimary, backgroundColor: t.bgInput }} type='digit' placeholder='最大' placeholderTextColor={t.textTertiary} value={max} onInput={(e: any) => onMax(e.detail.value)} />
    </View>
  )
}
