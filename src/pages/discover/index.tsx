// 发现页（v1.7.29 信息架构收敛）：纯公共寻货大厅——排序栏 + 型号搜索 + 品牌/地区筛选（search 结果页同款风格）。
// "我的寻货"回归"我的"tab 独立页（pages/my/sourcing），本页只服务匿名可逛的进行中需求；
// 发布/应答需登录（商户身份）。滚动无限分页（每页 20 条，触底追加，不设总量上限）
// RN 约束：仅 flex 布局、无 fixed/vh、Text 包裹、lineHeight 数值、样式数值单位
import { useState } from 'react'
import { View, Text, Input, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import Icon from '../../components/Icon'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import CustomTabBar from '../../components/CustomTabBar'
import { useAuthStore } from '../../stores/auth'
import { getSourcingFeed, getBrands, type SourcingFeedItem } from '../../services/sourcing'
import type { HomeRef } from '../../services/home'
import { getItem, removeItem } from '../../utils/storage'

// 编译期配置：禁用外层 ScrollView，滚动由页内统一提供
definePageConfig({ disableScroll: true })

/** 收货地区选项（34 省级简称；寻货单地区为自由文本，服务端按包含匹配） */
const REGIONS = [
  '北京', '天津', '上海', '重庆', '河北', '山西', '辽宁', '吉林', '黑龙江',
  '江苏', '浙江', '安徽', '福建', '江西', '山东', '河南', '湖北', '湖南',
  '广东', '海南', '四川', '贵州', '云南', '陕西', '甘肃', '青海',
  '内蒙古', '广西', '西藏', '宁夏', '新疆', '香港', '澳门', '台湾',
]

/** 相对时间（feed 卡片右上角：刚刚/N小时前/N天前） */
function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  return `${days}天前`
}

/** 发现页：寻货 feed */
export default function DiscoverPage() {
  const t = useTheme()
  const fs = useFs()
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const [keyword, setKeyword] = useState('')
  // 改动说明（v1.7.29 信息架构收敛）：删"进行中/我的寻货"双态 chips——"我的寻货"回归
  // "我的"tab 独立页，本页为纯公共大厅；新增发布时间升降序（search 结果页同款排序栏）
  const [sortAsc, setSortAsc] = useState(false)
  // 筛选（search 同款内联面板）：pick=面板内暂存（重置/确定前不生效），F=已应用查询态
  const [showFilter, setShowFilter] = useState(false)
  const [brandPick, setBrandPick] = useState<string | null>(null)
  const [regionPick, setRegionPick] = useState<string | null>(null)
  const [brandF, setBrandF] = useState<string | null>(null)
  const [regionF, setRegionF] = useState<string | null>(null)
  const [brands, setBrands] = useState<HomeRef[]>([])
  const [brandsLoaded, setBrandsLoaded] = useState(false)
  const [items, setItems] = useState<SourcingFeedItem[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const hasAnyFilter = brandF !== null || regionF !== null

  /** 拉取列表（查询态全部显式传参，避免闭包读到旧 state） */
  const load = async (nextPage: number, kw: string, brand: string | null, region: string | null, asc: boolean) => {
    if (loading) return
    setLoading(true)
    const r = await getSourcingFeed(kw, true, nextPage, { brand: brand ?? undefined, region: region ?? undefined, sort: asc ? 'asc' : 'desc' })
    setLoading(false)
    if (!r) return
    setItems((prev) => (nextPage === 1 ? r.items : [...prev, ...r.items]))
    setPage(nextPage)
    setTotal(r.total)
  }

  /** 查询态任一变化时重置回第一页 */
  const resetQuery = (kw: string, brand: string | null, region: string | null, asc: boolean) => {
    setItems([])
    void load(1, kw, brand, region, asc)
  }

  /** 打开/关闭筛选面板（首次打开懒加载品牌字典；打开时初始化暂存值=已应用值） */
  const toggleFilter = async () => {
    if (showFilter) {
      setShowFilter(false)
      return
    }
    setBrandPick(brandF)
    setRegionPick(regionF)
    setShowFilter(true)
    if (!brandsLoaded) {
      const list = await getBrands()
      setBrands(list)
      setBrandsLoaded(true)
    }
  }

  /** 面板确定：暂存值生效并重查 */
  const applyFilter = () => {
    setBrandF(brandPick)
    setRegionF(regionPick)
    setShowFilter(false)
    resetQuery(keyword, brandPick, regionPick, sortAsc)
  }

  /** 面板重置：仅清暂存（点确定才生效） */
  const resetFilter = () => {
    setBrandPick(null)
    setRegionPick(null)
  }

  // 进入页面刷新（发布/应答后返回列表即时更新）
  // 改动说明（v1.7.21 反向导购）：消费商家寻货页"需求信号"跳转时经 storage 传递的搜索词
  // （tabBar 页 switchTab 不能带 query，storage 是三端一致的传参通道）
  useDidShow(() => {
    void (async () => {
      const kw = await getItem('sourcing_search_kw')
      if (kw) {
        await removeItem('sourcing_search_kw')
        setKeyword(kw)
        resetQuery(kw, brandF, regionF, sortAsc)
      } else {
        resetQuery(keyword, brandF, regionF, sortAsc)
      }
    })()
  })

  const goDetail = (id: string) => Taro.navigateTo({ url: `/pages/discover/detail?id=${id}` })

  // 发布入口：登录门槛（个人即可发布，不要求商户）
  const goPublish = () => {
    if (!isLoggedIn) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      Taro.navigateTo({ url: '/pages/auth/login' })
      return
    }
    Taro.navigateTo({ url: '/pages/discover/publish' })
  }

  const shown = items
  const hasMore = items.length < total

  return (
    <PageLayout
      nav={<NavBar title='发现' />}
      // 改动说明（v1.7.19）：搜索行+过滤chips+发布按钮整体进吸顶区（weapp 胶囊不再与
      // 导航右侧内容冲突；发布从导航栏挪到 chips 行右端，参照主流 feed 页）
      subHeader={
        <View style={{ backgroundColor: t.bgPage, paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 4 }}>
          {/* 搜索行 */}
          <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1, display: 'flex', flexDirection: 'row', alignItems: 'center', height: 38, borderRadius: 19, backgroundColor: t.bgInput, paddingLeft: 12, paddingRight: 12 }}>
              <Icon name='search' size={16} color={t.textTertiary} />
              <Input
                style={{ ...fs(15), flex: 1, marginLeft: 6, marginRight: 6, color: t.textPrimary }}
                placeholder='搜索型号，如 6205'
                placeholderTextColor={t.textTertiary}
                value={keyword}
                onInput={(e) => setKeyword(e.detail.value)}
                onConfirm={() => resetQuery(keyword, brandF, regionF, sortAsc)}
                confirmType='search'
              />
            </View>
            <Text style={{ ...fs(14), color: t.primary, marginLeft: 10 }} onClick={() => resetQuery(keyword, brandF, regionF, sortAsc)}>搜索</Text>
          </View>
          {/* 排序栏（search 结果页同款）：发布时间升降序 + 右端筛选/发布 */}
          <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', paddingTop: 8, paddingBottom: 4 }}>
            <View
              style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', paddingLeft: 4, paddingRight: 12, paddingTop: 4, paddingBottom: 4 }}
              onClick={() => { setSortAsc(false); resetQuery(keyword, brandF, regionF, false) }}
            >
              <Text style={{ ...fs(13), color: !sortAsc ? t.primaryText : t.textSecondary, fontWeight: !sortAsc ? 'bold' : 'normal' }}>最新</Text>
              {!sortAsc && <Text style={{ ...fs(11), color: t.primaryText }}> ↓</Text>}
            </View>
            <View
              style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', paddingRight: 12, paddingTop: 4, paddingBottom: 4 }}
              onClick={() => { setSortAsc(true); resetQuery(keyword, brandF, regionF, true) }}
            >
              <Text style={{ ...fs(13), color: sortAsc ? t.primaryText : t.textSecondary, fontWeight: sortAsc ? 'bold' : 'normal' }}>最早</Text>
              {sortAsc && <Text style={{ ...fs(11), color: t.primaryText }}> ↑</Text>}
            </View>
            <View style={{ flex: 1 }} />
            <View
              style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', paddingRight: 12, paddingTop: 4, paddingBottom: 4 }}
              onClick={() => void toggleFilter()}
            >
              <Icon name='filter' size={15} color={hasAnyFilter || showFilter ? t.primaryText : t.textSecondary} />
              <Text style={{ ...fs(13), color: hasAnyFilter || showFilter ? t.primaryText : t.textSecondary, marginLeft: 3 }}>筛选</Text>
            </View>
            <View
              style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', paddingLeft: 12, paddingRight: 12, paddingTop: 5, paddingBottom: 5, borderRadius: 15, backgroundColor: t.primaryLight }}
              onClick={goPublish}
            >
              <Icon name='plus' size={14} color={t.primaryText} />
              <Text style={{ ...fs(13), color: t.primaryText, marginLeft: 2 }}>发布</Text>
            </View>
          </View>
          {/* 已选筛选 chips（search 同款；点 × 单项清除即重查） */}
          {hasAnyFilter && (
            <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', paddingTop: 4, paddingBottom: 4 }}>
              {regionF && (
                <View
                  style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', paddingLeft: 10, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderRadius: 12, backgroundColor: t.primaryLight, marginRight: 8 }}
                  onClick={() => { setRegionF(null); resetQuery(keyword, brandF, null, sortAsc) }}
                >
                  <Text style={{ ...fs(12, true), color: t.primaryText }}>地区:{regionF}</Text>
                  <Icon name='x' size={12} color={t.primaryText} />
                </View>
              )}
              {brandF && (
                <View
                  style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', paddingLeft: 10, paddingRight: 8, paddingTop: 4, paddingBottom: 4, borderRadius: 12, backgroundColor: t.primaryLight }}
                  onClick={() => { setBrandF(null); resetQuery(keyword, null, regionF, sortAsc) }}
                >
                  <Text style={{ ...fs(12, true), color: t.primaryText }}>品牌:{brandF}</Text>
                  <Icon name='x' size={12} color={t.primaryText} />
                </View>
              )}
            </View>
          )}
          {/* 筛选面板（search 同款内联展开）：地区/品牌单选暂存，重置清暂存、确定才生效 */}
          {showFilter && (
            <View style={{ marginTop: 6, paddingLeft: 12, paddingRight: 12, paddingTop: 12, paddingBottom: 12, backgroundColor: t.bgCard, borderRadius: 12, display: 'flex', flexDirection: 'column' }}>
              <Text style={{ ...fs(14), color: t.textPrimary, fontWeight: '600' }}>收货地区</Text>
              <View style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
                <View
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingLeft: 12, paddingRight: 12, paddingTop: 5, paddingBottom: 5, borderRadius: 14, marginRight: 8, marginBottom: 8, backgroundColor: regionPick === null ? t.primaryLight : t.bgInput }}
                  onClick={() => setRegionPick(null)}
                >
                  <Text style={{ ...fs(13), color: regionPick === null ? t.primaryText : t.textSecondary }}>不限</Text>
                </View>
                {REGIONS.map((r) => (
                  <View
                    key={r}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingLeft: 12, paddingRight: 12, paddingTop: 5, paddingBottom: 5, borderRadius: 14, marginRight: 8, marginBottom: 8, backgroundColor: regionPick === r ? t.primaryLight : t.bgInput }}
                    onClick={() => setRegionPick(r)}
                  >
                    <Text style={{ ...fs(13), color: regionPick === r ? t.primaryText : t.textSecondary }}>{r}</Text>
                  </View>
                ))}
              </View>
              <Text style={{ ...fs(14), color: t.textPrimary, fontWeight: '600', marginTop: 4 }}>期望品牌</Text>
              <ScrollView scrollY style={{ maxHeight: 200, marginTop: 4 }}>
                <View
                  style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', paddingTop: 10, paddingBottom: 10 }}
                  onClick={() => setBrandPick(null)}
                >
                  <Text style={{ ...fs(14), flex: 1, color: brandPick === null ? t.primaryText : t.textSecondary, fontWeight: brandPick === null ? 'bold' : 'normal' }}>不限</Text>
                  {brandPick === null && <Icon name='check' size={16} color={t.primary} />}
                </View>
                {brands.map((b) => (
                  <View
                    key={b.id}
                    style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', paddingTop: 10, paddingBottom: 10 }}
                    onClick={() => setBrandPick(b.name)}
                  >
                    <Text style={{ ...fs(14), flex: 1, color: brandPick === b.name ? t.primaryText : t.textSecondary, fontWeight: brandPick === b.name ? 'bold' : 'normal' }}>{b.name}</Text>
                    {brandPick === b.name && <Icon name='check' size={16} color={t.primary} />}
                  </View>
                ))}
                {brands.length === 0 && (
                  <Text style={{ ...fs(13), color: t.textTertiary, paddingTop: 10, paddingBottom: 10 }}>品牌字典加载中或暂无数据</Text>
                )}
              </ScrollView>
              <View style={{ display: 'flex', flexDirection: 'row', marginTop: 8 }}>
                <View
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 10, paddingBottom: 10, borderRadius: 10, borderWidth: 1, borderColor: t.border }}
                  onClick={resetFilter}
                >
                  <Text style={{ ...fs(14), color: t.textSecondary }}>重置</Text>
                </View>
                <View
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: 10, paddingBottom: 10, borderRadius: 10, backgroundColor: t.primary, marginLeft: 10 }}
                  onClick={applyFilter}
                >
                  <Text style={{ ...fs(14), color: t.textOnPrimary, fontWeight: 'bold' }}>确定</Text>
                </View>
              </View>
            </View>
          )}
        </View>
      }
      // 改动说明（v1.7.19）：页内不再自套 ScrollView（weapp 骨架已内置滚动），
      // 触底加载经 PageLayout onEndReached 透传（滚动无限分页，不设总量上限）
      onEndReached={() => { if (hasMore && !loading) void load(page + 1, keyword, brandF, regionF, sortAsc) }}
      tabbar={<CustomTabBar />}
    >
      {shown.length === 0 && !loading && (
          <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 80 }}>
            <Icon name='compass' size={40} color={t.textTertiary} />
            <Text style={{ ...fs(14), color: t.textTertiary, marginTop: 12 }}>
              {keyword
                ? '没有找到相关寻货'
                : hasAnyFilter
                  ? '没有符合筛选条件的寻货'
                  : '还没有进行中的寻货，点上方「发布」发第一条'}
            </Text>
          </View>
        )}
      {/* 改动说明（v1.7.19）：原页内 ScrollView 移除，滚动与触底由 PageLayout 统一提供 */}
      {shown.map((item, i) => (
          <View
            key={item.id}
            style={{
              marginLeft: 12, marginRight: 12, marginTop: i === 0 ? 6 : 8, paddingLeft: 14, paddingRight: 14, paddingTop: 14, paddingBottom: 14,
              backgroundColor: t.bgCard, borderRadius: 12,
            }}
            onClick={() => goDetail(item.id)}
          >
            {/* 首行：型号 + 状态 */}
            <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ ...fs(16), color: t.textPrimary, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                寻 {item.partNumber}
              </Text>
              {/* 改动说明（v2.10.0 寻货置顶）：置顶期需求带醒目金色角标（服务端已按置顶排序） */}
              {item.isPinned && (
                <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', paddingLeft: 6, paddingRight: 6, paddingTop: 2, paddingBottom: 2, borderRadius: 6, backgroundColor: t.warning, marginRight: 6 }}>
                  <Icon name='arrow-up-circle' size={10} color='#FFFFFF' />
                  <Text style={{ ...fs(10), color: '#FFFFFF', fontWeight: '700' }}>置顶</Text>
                </View>
              )}
              {/* 改动说明（v1.7.29）：本页恒为进行中单，原 mine 状态章随双态收敛删除；"我发布"角标仅登录发布者可见 */}
              {/* 改动说明（v2.12.0 商户名义发布）：商户单显"商户"徽章（全名与跳转在详情页） */}
              {item.publisherType === 'merchant' && (
                <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2, borderRadius: 8, backgroundColor: t.primaryLight, marginRight: 6 }}>
                  <Text style={{ ...fs(11), color: t.primary }}>商户</Text>
                </View>
              )}
              {item.isMine && (
                <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2, borderRadius: 8, backgroundColor: t.primaryLight, marginRight: 6 }}>
                  <Text style={{ ...fs(11), color: t.primary }}>我发布</Text>
                </View>
              )}
              <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2, borderRadius: 8, backgroundColor: t.bgInput }}>
                <Text style={{ ...fs(11), color: t.textSecondary }}>{item.responseCount > 0 ? `${item.responseCount} 家应答` : '等待应答'}</Text>
              </View>
            </View>
            {/* 次行：品牌/数量/地区 */}
            <Text style={{ ...fs(13), color: t.textSecondary, marginTop: 6 }} numberOfLines={1}>
              {[item.brand, item.quantity, item.region].filter(Boolean).join(' · ') || '详情见需求说明'}
            </Text>
            {/* 底行：时间 + 过期提示 */}
            <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
              <Text style={{ ...fs(12), color: t.textTertiary }}>{relativeTime(item.createdAt)}</Text>
              <Text style={{ ...fs(12), color: t.textTertiary }}>{relativeTime(item.expiryAt).replace('前', '后过期')}</Text>
            </View>
          </View>
        ))}
        {shown.length > 0 && (
          <Text style={{ ...fs(12), color: t.textTertiary, textAlign: 'center', marginTop: 14, marginBottom: 24 }}>
            {loading ? '加载中…' : hasMore ? '上拉加载更多' : '没有更多了'}
          </Text>
        )}
    </PageLayout>
  )
}
