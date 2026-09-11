// 我的关注商家页：分页列表 + 行内取消关注。数据经 BFF /mobile/followed（API /api/me/follows/merchants）。
// 与收藏页同范式：登录态订阅 store，未登录展示引导空态。
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
import { getFollowedMerchants, toggleFollow, type FollowedItem } from '../../services/user'

definePageConfig({ disableScroll: true })

const PAGE_SIZE = 20

/** 关注商家列表页：展示商家名称/公司与关注时间，支持逐条取关与分页加载 */
export default function FollowedPage() {
  const t = useTheme()
  const fs = useFs()
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)

  const [items, setItems] = useState<FollowedItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState('')

  /** 加载关注分页（append=true 追加下一页） */
  const load = async (p: number, append: boolean) => {
    if (!isLoggedIn) { setItems([]); setTotal(0); return }
    setLoading(true)
    try {
      const r = await getFollowedMerchants(p, PAGE_SIZE)
      setItems((prev) => (append ? [...prev, ...(r?.items || [])] : r?.items || []))
      setTotal(r?.totalCount || 0)
      setPage(p)
    } catch { /* 保留已有数据 */ } finally { setLoading(false) }
  }

  useDidShow(() => { load(1, false) })

  /** 取消关注（确认后调 DELETE 代理，成功即本地移除该行） */
  const onUnfollow = (item: FollowedItem) => {
    showConfirmDialog({ title: '取消关注', content: `不再关注「${item.merchant.name}」？` }).then(async (ok) => {
        if (!ok) return
        setBusyId(item.merchant.id)
        try {
          await toggleFollow(item.merchant.id, true)
          setItems((prev) => prev.filter((x) => x.id !== item.id))
          setTotal((n) => Math.max(0, n - 1))
          Taro.showToast({ title: '已取消关注', icon: 'none' })
        } catch {
          Taro.showToast({ title: '操作失败', icon: 'none' })
        } finally { setBusyId('') }
      })
  }

  const goDetail = (id: string) => Taro.navigateTo({ url: `/pages/merchant/merchantDetail?id=${id}` })
  const hasMore = items.length < total

  return (
    <PageLayout nav={<NavBar title="我的关注" showBack />}>
      {!isLoggedIn && (
        <View style={{ alignItems: 'center', paddingTop: 80 }}>
          <Icon name="users" size={48} color={t.textTertiary} />
          <Text style={{ ...fs(15), color: t.textSecondary, marginTop: 12 }}>登录后可查看关注</Text>
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
          <Icon name="users" size={48} color={t.textTertiary} />
          <Text style={{ ...fs(15), color: t.textSecondary, marginTop: 12 }}>还没有关注，去商家详情页看看吧</Text>
        </View>
      )}
      {items.map((item) => (
        <View
          key={item.id}
          style={{ backgroundColor: t.bgCard, borderBottomWidth: 1, borderBottomColor: t.border, paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, flexDirection: 'row', alignItems: 'center' }}
          onClick={() => goDetail(item.merchant.id)}
        >
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.primaryLight, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
            <Icon name="store" size={20} color={t.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ ...fs(16), color: t.textPrimary }}>{item.merchant.name}</Text>
            <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 4 }}>
              {item.merchant.companyName || (item.merchant.isVerified ? '认证商家' : '')}
              {'\n'}关注于 {formatTime(item.createdAt)}
            </Text>
          </View>
          <View
            style={{ padding: 10, opacity: busyId === item.merchant.id ? 0.4 : 1 }}
            onClick={() => { if (busyId !== item.merchant.id) onUnfollow(item) }}
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
