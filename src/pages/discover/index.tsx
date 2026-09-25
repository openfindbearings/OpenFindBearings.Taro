// 发现页（v1.7.19 转正）：寻货需求 feed——个人用户发布的求购询价单浏览与搜索。
// 占位期文案兑现：点对点找货；浏览匿名可访问，发布/应答需登录（商户身份）
// RN 约束：仅 flex 布局、无 fixed/vh、Text 包裹、lineHeight 数值、样式数值单位
import { useState } from 'react'
import { View, Text, ScrollView, Input } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import Icon from '../../components/Icon'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import CustomTabBar from '../../components/CustomTabBar'
import { useAuthStore } from '../../stores/auth'
import { getSourcingFeed, type SourcingFeedItem } from '../../services/sourcing'

// 编译期配置：禁用外层 ScrollView，滚动由页内统一提供
definePageConfig({ disableScroll: true })

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
  // 过滤器：all=全部进行中 / unanswered=仅未应答
  const [filter, setFilter] = useState<'all' | 'unanswered'>('all')
  const [items, setItems] = useState<SourcingFeedItem[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const load = async (nextPage: number, kw: string) => {
    if (loading) return
    setLoading(true)
    const r = await getSourcingFeed(kw, true, nextPage)
    setLoading(false)
    if (!r) return
    setItems((prev) => (nextPage === 1 ? r.items : [...prev, ...r.items]))
    setPage(nextPage)
    setTotal(r.total)
  }

  // 进入页面刷新（发布/应答后返回列表即时更新）
  useDidShow(() => { void load(1, keyword) })

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

  const shown = filter === 'unanswered' ? items.filter((i) => i.responseCount === 0) : items
  const hasMore = items.length < total

  return (
    <PageLayout nav={<NavBar title='寻货' rightSlot={<Text style={{ ...fs(14), color: t.primary, fontWeight: '600' }} onClick={goPublish}>发布</Text>} />} tabbar={<CustomTabBar />}>
      {/* 搜索行 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 16, paddingTop: 8 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', height: 38, borderRadius: 19, backgroundColor: t.bgInput, paddingLeft: 12, paddingRight: 12 }}>
          <Icon name='search' size={16} color={t.textTertiary} />
          <Input
            style={{ flex: 1, marginLeft: 6, marginRight: 6, color: t.textPrimary }}
            placeholder='搜索型号，如 6205'
            placeholderTextColor={t.textTertiary}
            value={keyword}
            onInput={(e) => setKeyword(e.detail.value)}
            onConfirm={() => void load(1, keyword)}
            confirmType='search'
          />
        </View>
        <Text style={{ ...fs(14), color: t.primary, marginLeft: 10 }} onClick={() => void load(1, keyword)}>搜索</Text>
      </View>

      {/* 过滤 chips */}
      <View style={{ flexDirection: 'row', paddingLeft: 16, paddingTop: 10, paddingBottom: 4 }}>
        {([
          { key: 'all', label: '全部寻货' },
          { key: 'unanswered', label: '等待应答' },
        ] as const).map((f) => (
          <View
            key={f.key}
            style={{
              paddingLeft: 14, paddingRight: 14, paddingTop: 5, paddingBottom: 5, borderRadius: 15, marginRight: 8,
              backgroundColor: filter === f.key ? t.primary : t.bgInput,
            }}
            onClick={() => setFilter(f.key)}
          >
            <Text style={{ ...fs(13), color: filter === f.key ? '#FFFFFF' : t.textSecondary }}>{f.label}</Text>
          </View>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} onScrollToLower={() => { if (hasMore) void load(page + 1, keyword) }}>
        {shown.length === 0 && !loading && (
          <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 80 }}>
            <Icon name='compass' size={40} color={t.textTertiary} />
            <Text style={{ ...fs(14), color: t.textTertiary, marginTop: 12 }}>
              {keyword ? '没有找到相关寻货' : '还没有进行中的寻货，点右上角发布第一条'}
            </Text>
          </View>
        )}
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
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ ...fs(16), color: t.textPrimary, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                寻 {item.partNumber}
              </Text>
              {item.isMine && (
                <View style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2, borderRadius: 8, backgroundColor: t.primaryLight, marginRight: 6 }}>
                  <Text style={{ ...fs(11), color: t.primary }}>我发布</Text>
                </View>
              )}
              <View style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2, borderRadius: 8, backgroundColor: t.bgInput }}>
                <Text style={{ ...fs(11), color: t.textSecondary }}>{item.responseCount > 0 ? `${item.responseCount} 家应答` : '等待应答'}</Text>
              </View>
            </View>
            {/* 次行：品牌/数量/地区 */}
            <Text style={{ ...fs(13), color: t.textSecondary, marginTop: 6 }} numberOfLines={1}>
              {[item.brand, item.quantity, item.region].filter(Boolean).join(' · ') || '详情见需求说明'}
            </Text>
            {/* 底行：时间 + 过期提示 */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
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
      </ScrollView>
    </PageLayout>
  )
}
