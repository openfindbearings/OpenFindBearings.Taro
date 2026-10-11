// 商城页（v2.14.0 商城导购）：从"积分权益橱窗"升级为"货源导购"——全站在售货源商品瀑布流。
// 信息架构：商城 Tab = 供给侧货源导购（对比 首页=工具查询、发现=需求侧寻货）。
// 数据源：BFF /mobile/mall/feed（匿名可访问）；卡片进货源详情（轴承详情），商家行进店铺页。
// 权益兑换主体迁至"我的-积分"线（pages/my/redeem），本页顶部留小入口。
// 交易能力（购物车/下单/支付）为闭源增量，经扩展点 ProProductAction 后插，本页不含成交。
// RN 约束：仅 flex 布局、无 fixed/vh、Text 包裹、lineHeight/fontSize 数值。
import { useState } from 'react'
import { View, Text, Input, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import Icon from '../../components/Icon'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import CustomTabBar from '../../components/CustomTabBar'
import ProductCard from '../../components/ProductCard'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import { getMallFeed, type MallFeedItem, type MallFeedParams } from '../../services/mall'
import { getHome, type HomeRef } from '../../services/home'

// 编译期配置：禁用外层 ScrollView，滚动由 PageLayout 统一提供
definePageConfig({ disableScroll: true })

/** 每页条数 */
const PAGE_SIZE = 20

/** 排序栏选项（对应 API sortBy） */
const SORTS: { key: 'created' | 'price' | 'viewcount'; label: string }[] = [
  { key: 'created', label: '综合' },
  { key: 'price', label: '价格' },
  { key: 'viewcount', label: '热度' }
]

/** 尺寸筛选内部状态 */
interface SizeState { minIn?: number; maxIn?: number; minOut?: number; maxOut?: number; minW?: number; maxW?: number }

/** 商城货源导购页 */
export default function MallPage() {
  const t = useTheme()
  const fs = useFs()

  // 搜索
  const [input, setInput] = useState('')
  const [keyword, setKeyword] = useState('')
  // 排序
  const [sortBy, setSortBy] = useState<'created' | 'price' | 'viewcount'>('created')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  // 筛选
  const [showFilter, setShowFilter] = useState(false)
  const [brand, setBrand] = useState<HomeRef | null>(null)
  const [type, setType] = useState<HomeRef | null>(null)
  const [sizeInput, setSizeInput] = useState({ minIn: '', maxIn: '', minOut: '', maxOut: '', minW: '', maxW: '' })
  const [size, setSize] = useState<SizeState>({})
  const [brands, setBrands] = useState<HomeRef[]>([])
  const [types, setTypes] = useState<HomeRef[]>([])
  // 列表
  const [items, setItems] = useState<MallFeedItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  /** 组装货源流查询参数（关键词 + 品牌/类型/尺寸 + 排序 + 分页），over 覆盖变更字段 */
  const buildParams = (p: number, over?: Partial<MallFeedParams>): MallFeedParams => ({
    keyword: keyword.trim() || undefined,
    brandId: brand?.id,
    bearingTypeId: type?.id,
    sortBy,
    sortOrder,
    minInnerDiameter: size.minIn,
    maxInnerDiameter: size.maxIn,
    minOuterDiameter: size.minOut,
    maxOuterDiameter: size.maxOut,
    minWidth: size.minW,
    maxWidth: size.maxW,
    page: p,
    pageSize: PAGE_SIZE,
    ...over
  })

  /** 拉取货源流（reset=true 覆盖，false 追加下一页） */
  const load = async (reset: boolean, over?: Partial<MallFeedParams>) => {
    const p = reset ? 1 : page + 1
    if (reset) setLoading(true)
    else setLoadingMore(true)
    try {
      const r = await getMallFeed(buildParams(p, over))
      const list = r?.items || []
      setItems((prev) => (reset ? list : [...prev, ...list]))
      setTotal(r?.totalCount ?? 0)
      setPage(p)
    } catch {
      if (reset) { setItems([]); setTotal(0) }
    }
    setLoading(false)
    setLoadingMore(false)
  }

  // 进页/回页加载（品牌/类型字典一次性拉取，供筛选面板）
  useDidShow(() => {
    void load(true)
    getHome().then((h) => { setBrands(h?.brands || []); setTypes(h?.bearingTypes || []) }).catch(() => { /* 静默 */ })
  })

  /** 关键词搜索 */
  const doSearch = () => {
    const k = input.trim()
    setKeyword(k)
    setPage(1)
    void load(true, { keyword: k || undefined })
  }

  /** 排序：点击已选字段切换升降序，否则选中新字段（热度默认降序，其余升序） */
  const handleSort = (key: 'created' | 'price' | 'viewcount') => {
    let order: 'asc' | 'desc'
    if (sortBy === key) order = sortOrder === 'asc' ? 'desc' : 'asc'
    else order = key === 'created' ? 'desc' : 'asc'
    setSortBy(key)
    setSortOrder(order)
    setPage(1)
    void load(true, { sortBy: key, sortOrder: order })
  }

  /** 选/清品牌筛选 */
  const selectBrand = (b: HomeRef | null) => { setBrand(b); setPage(1); void load(true, { brandId: b?.id }) }
  /** 选/清类型筛选 */
  const selectType = (x: HomeRef | null) => { setType(x); setPage(1); void load(true, { bearingTypeId: x?.id }) }

  /** 应用尺寸筛选 */
  const applySize = () => {
    const num = (s: string) => (s.trim() === '' ? undefined : Number(s))
    const sf: SizeState = { minIn: num(sizeInput.minIn), maxIn: num(sizeInput.maxIn), minOut: num(sizeInput.minOut), maxOut: num(sizeInput.maxOut), minW: num(sizeInput.minW), maxW: num(sizeInput.maxW) }
    setSize(sf)
    setShowFilter(false)
    setPage(1)
    void load(true, { minInnerDiameter: sf.minIn, maxInnerDiameter: sf.maxIn, minOuterDiameter: sf.minOut, maxOuterDiameter: sf.maxOut, minWidth: sf.minW, maxWidth: sf.maxW })
  }

  /** 清空尺寸筛选 */
  const clearSize = () => {
    setSize({})
    setSizeInput({ minIn: '', maxIn: '', minOut: '', maxOut: '', minW: '', maxW: '' })
    setPage(1)
    void load(true, { minInnerDiameter: undefined, maxInnerDiameter: undefined, minOuterDiameter: undefined, maxOuterDiameter: undefined, minWidth: undefined, maxWidth: undefined })
  }

  /** 触底加载下一页 */
  const loadMore = () => {
    if (loadingMore || loading || items.length >= total) return
    void load(false)
  }

  const goBearing = (id: string) => Taro.navigateTo({ url: `/pages/home/bearingDetail?id=${id}` })
  const goMerchant = (id: string) => Taro.navigateTo({ url: `/pages/merchant/merchantDetail?id=${id}` })

  const hasFilter = !!(brand || type || size.minIn != null || size.maxIn != null || size.minOut != null || size.maxOut != null || size.minW != null || size.maxW != null)

  /** 尺寸范围文案 */
  const fmtRange = (min?: number, max?: number) => {
    if (min != null && max != null) return `${min}-${max}`
    if (min != null) return `≥${min}`
    if (max != null) return `≤${max}`
    return ''
  }

  return (
    <PageLayout nav={<NavBar title='商城' />} tabbar={<CustomTabBar />} onEndReached={loadMore}>
      <View>
        {/* 顶部：权益兑换入口（主体已迁至"我的-积分"线，此处留小入口） */}
        <View
          style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', backgroundColor: t.bgCard, marginLeft: 12, marginRight: 12, marginTop: 12, borderRadius: 12, paddingLeft: 14, paddingRight: 14, paddingTop: 11, paddingBottom: 11 }}
          onClick={() => Taro.navigateTo({ url: '/pages/my/redeem' })}
        >
          <Icon name='gift' size={18} color={t.primary} />
          <Text style={{ ...fs(14), color: t.textPrimary, marginLeft: 8, flex: 1 }}>轴承币权益兑换</Text>
          <Text style={{ ...fs(12), color: t.textTertiary }}>置顶卡 · 挂礼</Text>
          <Icon name='chevron-right' size={16} color={t.textTertiary} />
        </View>

        {/* 搜索输入行 */}
        <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', backgroundColor: t.bgInput, marginLeft: 12, marginRight: 12, marginTop: 12, borderRadius: 20, paddingLeft: 12, paddingRight: 12 }}>
          <Icon name='search' size={18} color={t.textTertiary} />
          <Input
            style={{ ...fs(15), color: t.textPrimary, flex: 1, marginLeft: 8, paddingTop: 8, paddingBottom: 8 }}
            type='text'
            placeholder='搜型号、品牌、类型...'
            placeholderTextColor={t.textTertiary}
            value={input}
            onInput={(e: any) => setInput(e.detail.value)}
            onConfirm={doSearch}
            confirmType='search'
          />
          {input.length > 0 && (
            <View onClick={doSearch} style={{ paddingLeft: 8 }}>
              <Text style={{ ...fs(13), color: t.primary }}>搜索</Text>
            </View>
          )}
        </View>

        {/* 排序栏 + 筛选开关 */}
        <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', backgroundColor: t.bgCard, marginLeft: 12, marginRight: 12, marginTop: 12, borderRadius: 12, paddingLeft: 12, paddingRight: 12, paddingTop: 10, paddingBottom: 10 }}>
          {SORTS.map((s) => (
            <View key={s.key} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginRight: 18 }} onClick={() => handleSort(s.key)}>
              <Text style={{ ...fs(13, sortBy === s.key), color: sortBy === s.key ? t.primary : t.textSecondary }}>{s.label}</Text>
              {sortBy === s.key && s.key !== 'created' && (
                <Text style={{ ...fs(11), color: t.primary }}>{sortOrder === 'asc' ? ' ↑' : ' ↓'}</Text>
              )}
            </View>
          ))}
          <View style={{ flex: 1 }} />
          <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }} onClick={() => setShowFilter((v) => !v)}>
            <Icon name='filter' size={15} color={hasFilter ? t.primary : t.textSecondary} />
            <Text style={{ ...fs(13), color: hasFilter ? t.primary : t.textSecondary, marginLeft: 4 }}>筛选</Text>
          </View>
        </View>

        {/* 已选筛选 chips */}
        {hasFilter && (
          <View style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', marginLeft: 12, marginRight: 12, marginTop: 10 }}>
            {brand && (
              <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', backgroundColor: t.primaryLight, borderRadius: 14, paddingLeft: 10, paddingRight: 8, paddingTop: 4, paddingBottom: 4, marginRight: 8, marginBottom: 6 }} onClick={() => selectBrand(null)}>
                <Text style={{ ...fs(12, true), color: t.primary }}>品牌:{brand.name}</Text>
                <Icon name='x' size={12} color={t.primary} />
              </View>
            )}
            {type && (
              <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', backgroundColor: t.primaryLight, borderRadius: 14, paddingLeft: 10, paddingRight: 8, paddingTop: 4, paddingBottom: 4, marginRight: 8, marginBottom: 6 }} onClick={() => selectType(null)}>
                <Text style={{ ...fs(12, true), color: t.primary }}>类型:{type.name}</Text>
                <Icon name='x' size={12} color={t.primary} />
              </View>
            )}
            {(size.minIn != null || size.maxIn != null) && (
              <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', backgroundColor: t.primaryLight, borderRadius: 14, paddingLeft: 10, paddingRight: 8, paddingTop: 4, paddingBottom: 4, marginRight: 8, marginBottom: 6 }} onClick={clearSize}>
                <Text style={{ ...fs(12, true), color: t.primary }}>内径:{fmtRange(size.minIn, size.maxIn)}</Text>
                <Icon name='x' size={12} color={t.primary} />
              </View>
            )}
          </View>
        )}

        {/* 筛选面板：品牌 / 类型 / 尺寸 */}
        {showFilter && (
          <View style={{ backgroundColor: t.bgCard, marginLeft: 12, marginRight: 12, marginTop: 10, borderRadius: 12, padding: 14 }}>
            {/* 品牌 */}
            <Text style={{ ...fs(13), color: t.textSecondary }}>品牌</Text>
            <ScrollView scrollX style={{ display: 'flex', flexDirection: 'row', marginTop: 8, whiteSpace: 'nowrap' }}>
              {brands.map((b) => (
                <View key={b.id} style={{ display: 'flex', flexDirection: 'row', backgroundColor: brand?.id === b.id ? t.primary : t.bgInput, borderRadius: 14, paddingLeft: 12, paddingRight: 12, paddingTop: 5, paddingBottom: 5, marginRight: 8 }} onClick={() => selectBrand(brand?.id === b.id ? null : b)}>
                  <Text style={{ ...fs(12), color: brand?.id === b.id ? '#FFFFFF' : t.textSecondary }}>{b.name}</Text>
                </View>
              ))}
            </ScrollView>
            {/* 类型 */}
            <Text style={{ ...fs(13), color: t.textSecondary, marginTop: 12 }}>类型</Text>
            <ScrollView scrollX style={{ display: 'flex', flexDirection: 'row', marginTop: 8, whiteSpace: 'nowrap' }}>
              {types.map((x) => (
                <View key={x.id} style={{ display: 'flex', flexDirection: 'row', backgroundColor: type?.id === x.id ? t.primary : t.bgInput, borderRadius: 14, paddingLeft: 12, paddingRight: 12, paddingTop: 5, paddingBottom: 5, marginRight: 8 }} onClick={() => selectType(type?.id === x.id ? null : x)}>
                  <Text style={{ ...fs(12), color: type?.id === x.id ? '#FFFFFF' : t.textSecondary }}>{x.name}</Text>
                </View>
              ))}
            </ScrollView>
            {/* 尺寸 */}
            <Text style={{ ...fs(13), color: t.textSecondary, marginTop: 12 }}>尺寸范围 (mm)</Text>
            <FilterRange label='内径' t={t} fs={fs} min={sizeInput.minIn} max={sizeInput.maxIn} onMin={(v: string) => setSizeInput((s) => ({ ...s, minIn: v }))} onMax={(v: string) => setSizeInput((s) => ({ ...s, maxIn: v }))} />
            <FilterRange label='外径' t={t} fs={fs} min={sizeInput.minOut} max={sizeInput.maxOut} onMin={(v: string) => setSizeInput((s) => ({ ...s, minOut: v }))} onMax={(v: string) => setSizeInput((s) => ({ ...s, maxOut: v }))} />
            <FilterRange label='宽度' t={t} fs={fs} min={sizeInput.minW} max={sizeInput.maxW} onMin={(v: string) => setSizeInput((s) => ({ ...s, minW: v }))} onMax={(v: string) => setSizeInput((s) => ({ ...s, maxW: v }))} />
            <View style={{ display: 'flex', flexDirection: 'row', marginTop: 14 }}>
              <View style={{ flex: 1, borderRadius: 18, paddingTop: 9, paddingBottom: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: t.border }} onClick={clearSize}>
                <Text style={{ ...fs(14), color: t.textSecondary }}>重置</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 10, borderRadius: 18, paddingTop: 9, paddingBottom: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: t.primary }} onClick={applySize}>
                <Text style={{ ...fs(14), color: '#FFFFFF', fontWeight: 'bold' }}>确定</Text>
              </View>
            </View>
          </View>
        )}

        {/* 商品瀑布流（两列） */}
        <View style={{ marginLeft: 12, marginRight: 12, marginTop: 12 }}>
          {loading && (
            <View style={{ padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ ...fs(14), color: t.textSecondary }}>加载中…</Text>
            </View>
          )}
          {!loading && (
            <View style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
              {items.map((it) => (
                <View key={it.id} style={{ width: '48.5%' }}>
                  <ProductCard item={it} onPress={() => goBearing(it.bearingId)} onMerchant={() => goMerchant(it.merchantId)} />
                </View>
              ))}
            </View>
          )}
          {!loading && items.length === 0 && (
            <View style={{ paddingTop: 48, paddingBottom: 48, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Icon name='package' size={48} color={t.border} />
              <Text style={{ ...fs(15), color: t.textSecondary, marginTop: 12 }}>暂无货源</Text>
              <Text style={{ ...fs(13), color: t.textTertiary, marginTop: 6 }}>试试其他关键词或筛选条件</Text>
            </View>
          )}
          {!loading && items.length > 0 && items.length < total && (
            <View style={{ paddingTop: 12, paddingBottom: 12, display: 'flex', alignItems: 'center' }} onClick={loadMore}>
              <Text style={{ ...fs(14), color: t.primary }}>{loadingMore ? '加载中…' : '加载更多'}</Text>
            </View>
          )}
          {!loading && items.length > 0 && (
            <View style={{ paddingTop: 4, paddingBottom: 8, display: 'flex', alignItems: 'center' }}>
              <Text style={{ ...fs(12), color: t.textTertiary }}>共 {total} 条货源</Text>
            </View>
          )}
        </View>
        <View style={{ height: 80 }} />
      </View>
    </PageLayout>
  )
}

/** 单个尺寸区间输入行（内径/外径/宽度） */
function FilterRange({ label, t, fs, min, max, onMin, onMax }: any) {
  return (
    <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
      <Text style={{ ...fs(13), color: t.textSecondary, width: 40 }}>{label}</Text>
      <Input style={{ ...fs(13), color: t.textPrimary, backgroundColor: t.bgInput, flex: 1, borderRadius: 8, paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6 }} type='digit' placeholder='最小' placeholderTextColor={t.textTertiary} value={min} onInput={(e: any) => onMin(e.detail.value)} />
      <Text style={{ ...fs(13), color: t.textTertiary, marginLeft: 8, marginRight: 8 }}>—</Text>
      <Input style={{ ...fs(13), color: t.textPrimary, backgroundColor: t.bgInput, flex: 1, borderRadius: 8, paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6 }} type='digit' placeholder='最大' placeholderTextColor={t.textTertiary} value={max} onInput={(e: any) => onMax(e.detail.value)} />
    </View>
  )
}