// 我的收藏轴承页：分页列表 + 行内取消收藏。数据经 BFF /mobile/favorites（API /api/me/favorites/bearings）。
// 登录态订阅 auth store；未登录展示引导登录空态（页面自身兜底，入口不再弹窗拦截）。
import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import Icon from '../../components/Icon'
import { showConfirmDialog } from '../../components/ConfirmDialog'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import { formatTime } from '../../utils/format'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import { useAuthStore } from '../../stores/auth'
import { getFavorites, toggleFavorite, type FavoriteItem } from '../../services/user'

definePageConfig({ disableScroll: true })

const PAGE_SIZE = 20

/** 收藏列表页：展示型号/品牌/类型与收藏时间，支持逐条取消与分页加载 */
export default function FavoritesPage() {
  const t = useTheme()
  const fs = useFs()
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)

  const [items, setItems] = useState<FavoriteItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  // 正在移除中的行（禁用其按钮防重复提交）
  const [busyId, setBusyId] = useState('')

  /** 加载收藏分页（append=true 追加下一页） */
  const load = async (p: number, append: boolean) => {
    if (!isLoggedIn) { setItems([]); setTotal(0); return }
    setLoading(true)
    try {
      const r = await getFavorites(p, PAGE_SIZE)
      setItems((prev) => (append ? [...prev, ...(r?.items || [])] : r?.items || []))
      setTotal(r?.totalCount || 0)
      setPage(p)
    } catch { /* 保留已有数据 */ } finally { setLoading(false) }
  }

  useDidShow(() => { load(1, false) })

  /** 取消收藏（确认后调 DELETE 代理，成功即本地移除该行） */
  const onRemove = (item: FavoriteItem) => {
    showConfirmDialog({ title: '取消收藏', content: `不再收藏「${item.bearing.partNumber}」？` }).then(async (ok) => {
        if (!ok) return
        setBusyId(item.bearing.id)
        try {
          await toggleFavorite(item.bearing.id, true)
          setItems((prev) => prev.filter((x) => x.id !== item.id))
          setTotal((n) => Math.max(0, n - 1))
          Taro.showToast({ title: '已取消收藏', icon: 'none' })
        } catch {
          Taro.showToast({ title: '操作失败', icon: 'none' })
        } finally { setBusyId('') }
      })
  }

  const goDetail = (id: string) => Taro.navigateTo({ url: `/pages/home/bearingDetail?id=${id}` })
  const hasMore = items.length < total

  return (
    <PageLayout nav={<NavBar title="我的收藏" showBack />}>
      {!isLoggedIn && (
        <View style={{ alignItems: 'center', paddingTop: 80 }}>
          <Icon name="heart" size={48} color={t.textTertiary} />
          <Text style={{ ...fs(15), color: t.textSecondary, marginTop: 12 }}>登录后可查看收藏</Text>
          <View
            style={{ backgroundColor: t.primary, borderRadius: 20, paddingLeft: 24, paddingRight: 24, paddingTop: 8, paddingBottom: 8, marginTop: 16 }}
            onClick={() => Taro.navigateTo({ url: '/pages/auth/login' })}
          >
            <Text style={{ ...fs(15), color: t.textOnPrimary }}>去登录</Text>
          </View>
        </View>
      )}
      {isLoggedIn && items.length === 0 && !loading && (
        <View style={{ alignItems: 'center', paddingTop: 80 }}>
          <Icon name="heart" size={48} color={t.textTertiary} />
          <Text style={{ ...fs(15), color: t.textSecondary, marginTop: 12 }}>还没有收藏，去逛逛轴承详情吧</Text>
        </View>
      )}
      {items.map((item) => (
        <View
          key={item.id}
          style={{ backgroundColor: t.bgCard, borderBottomWidth: 1, borderBottomColor: t.border, paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, flexDirection: 'row', alignItems: 'center' }}
          onClick={() => goDetail(item.bearing.id)}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ ...fs(16), color: t.textPrimary }}>{item.bearing.partNumber}</Text>
            <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 4 }}>
              {[item.bearing.brandName, item.bearing.bearingType].filter(Boolean).join(' · ')}
              {'\n'}收藏于 {formatTime(item.createdAt)}
            </Text>
          </View>
          <View
            style={{ padding: 10, opacity: busyId === item.bearing.id ? 0.4 : 1 }}
            onClick={() => { if (busyId !== item.bearing.id) onRemove(item) }}
          >
            <Icon name="trash-2" size={18} color={t.danger} />
          </View>
        </View>
      ))}
      {isLoggedIn && hasMore && (
        <View style={{ alignItems: 'center', paddingTop: 14, paddingBottom: 14 }} onClick={() => { if (!loading) load(page + 1, true) }}>
          <Text style={{ ...fs(14), color: t.primaryText }}>{loading ? '加载中…' : '加载更多'}</Text>
        </View>
      )}
    </PageLayout>
  )
}
