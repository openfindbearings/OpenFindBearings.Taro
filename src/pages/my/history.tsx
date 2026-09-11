// 浏览历史页：轴承/商家双 Tab，逐条删除 + 一键清空。数据经 BFF /mobile/me/history/*。
// 上报入口在两个详情页（进入即 upsert），本页只做展示与清理。
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
import {
  getBearingHistory, getMerchantHistory,
  deleteBearingHistory, deleteMerchantHistory, clearHistory,
  type BearingHistoryItem, type MerchantHistoryItem
} from '../../services/user'

definePageConfig({ disableScroll: true })

const PAGE_SIZE = 20

type TabKey = 'bearing' | 'merchant'

/** 浏览历史页：分 Tab 展示最近浏览，支持单条删除与清空 */
export default function HistoryPage() {
  const t = useTheme()
  const fs = useFs()
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)

  const [tab, setTab] = useState<TabKey>('bearing')
  const [bearings, setBearings] = useState<BearingHistoryItem[]>([])
  const [merchants, setMerchants] = useState<MerchantHistoryItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState('')

  /** 按当前 Tab 加载分页（append=true 追加下一页） */
  const load = async (p: number, append: boolean, tk: TabKey = tab) => {
    if (!isLoggedIn) { setBearings([]); setMerchants([]); setTotal(0); return }
    setLoading(true)
    try {
      if (tk === 'bearing') {
        const r = await getBearingHistory(p, PAGE_SIZE)
        setBearings((prev) => (append ? [...prev, ...(r?.items || [])] : r?.items || []))
        setTotal(r?.totalCount || 0)
      } else {
        const r = await getMerchantHistory(p, PAGE_SIZE)
        setMerchants((prev) => (append ? [...prev, ...(r?.items || [])] : r?.items || []))
        setTotal(r?.totalCount || 0)
      }
      setPage(p)
    } catch { /* 保留已有数据 */ } finally { setLoading(false) }
  }

  useDidShow(() => { load(1, false) })

  /** 切换 Tab 并重新加载 */
  const switchTab = (tk: TabKey) => {
    if (tk === tab) return
    setTab(tk)
    load(1, false, tk)
  }

  /** 删除单条（确认后再调代理，成功即本地移除） */
  const onDelete = (item: BearingHistoryItem | MerchantHistoryItem, tk: TabKey) => {
    const label = tk === 'bearing'
      ? (item as BearingHistoryItem).bearingPartNumber
      : (item as MerchantHistoryItem).merchantName
    showConfirmDialog({ title: '删除记录', content: `删除「${label}」的浏览记录？` }).then(async (ok) => {
        if (!ok) return
        const key = tk === 'bearing' ? (item as BearingHistoryItem).bearingId : (item as MerchantHistoryItem).merchantId
        setBusyId(key)
        try {
          if (tk === 'bearing') {
            await deleteBearingHistory(key)
            setBearings((prev) => prev.filter((x) => x.bearingId !== key))
          } else {
            await deleteMerchantHistory(key)
            setMerchants((prev) => prev.filter((x) => x.merchantId !== key))
          }
          setTotal((n) => Math.max(0, n - 1))
        } catch {
          Taro.showToast({ title: '删除失败', icon: 'none' })
        } finally { setBusyId('') }
      })
  }

  /** 清空当前用户全部浏览历史（轴承+商家两表） */
  const onClearAll = () => {
    showConfirmDialog({ title: '清空历史', content: '确定清空全部浏览历史？该操作不可恢复。' }).then(async (ok) => {
        if (!ok) return
        try {
          await clearHistory()
          setBearings([])
          setMerchants([])
          setTotal(0)
          Taro.showToast({ title: '已清空', icon: 'none' })
        } catch {
          Taro.showToast({ title: '清空失败', icon: 'none' })
        }
      })
  }

  const rightIcons = isLoggedIn ? [{ name: 'trash-2', onClick: onClearAll }] : []
  const hasMore = (tab === 'bearing' ? bearings.length : merchants.length) < total

  return (
    <PageLayout nav={<NavBar title="浏览历史" showBack rightIcons={rightIcons} />}>
      {/* Tab 栏 */}
      <View style={{ flexDirection: 'row', backgroundColor: t.bgCard, borderBottomWidth: 1, borderBottomColor: t.border }}>
        {([
          { key: 'bearing', label: '轴承' },
          { key: 'merchant', label: '商家' }
        ] as const).map((tb) => (
          <View
            key={tb.key}
            style={{ flex: 1, alignItems: 'center', paddingTop: 12, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: tab === tb.key ? t.primary : 'transparent' }}
            onClick={() => switchTab(tb.key)}
          >
            <Text style={{ ...fs(15), color: tab === tb.key ? t.primaryText : t.textSecondary }}>{tb.label}</Text>
          </View>
        ))}
      </View>

      {!isLoggedIn && (
        <View style={{ alignItems: 'center', paddingTop: 80 }}>
          <Icon name="clock" size={48} color={t.textTertiary} />
          <Text style={{ ...fs(15), color: t.textSecondary, marginTop: 12 }}>登录后可查看浏览历史</Text>
          <View
            style={{ backgroundColor: t.primary, borderRadius: 20, paddingLeft: 24, paddingRight: 24, paddingTop: 8, paddingBottom: 8, marginTop: 16 }}
            onClick={() => Taro.navigateTo({ url: '/pages/auth/login' })}
          >
            <Text style={{ ...fs(15), color: t.textOnPrimary }}>去登录</Text>
          </View>
        </View>
      )}
      {isLoggedIn && (tab === 'bearing' ? bearings.length === 0 : merchants.length === 0) && !loading && (
        <View style={{ alignItems: 'center', paddingTop: 80 }}>
          <Icon name="clock" size={48} color={t.textTertiary} />
          <Text style={{ ...fs(15), color: t.textSecondary, marginTop: 12 }}>暂无浏览记录</Text>
        </View>
      )}
      {tab === 'bearing' && bearings.map((item) => (
        <View
          key={item.id}
          style={{ backgroundColor: t.bgCard, borderBottomWidth: 1, borderBottomColor: t.border, paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, flexDirection: 'row', alignItems: 'center' }}
          onClick={() => Taro.navigateTo({ url: `/pages/home/bearingDetail?id=${item.bearingId}` })}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ ...fs(16), color: t.textPrimary }}>{item.bearingPartNumber}</Text>
            <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 4 }}>
              {item.brandName ? `${item.brandName} · ` : ''}浏览 {item.viewCount} 次 · {formatTime(item.viewedAt)}
            </Text>
          </View>
          <View style={{ padding: 10, opacity: busyId === item.bearingId ? 0.4 : 1 }} onClick={() => { if (busyId !== item.bearingId) onDelete(item, 'bearing') }}>
            <Icon name="trash-2" size={18} color={t.danger} />
          </View>
        </View>
      ))}
      {tab === 'merchant' && merchants.map((item) => (
        <View
          key={item.id}
          style={{ backgroundColor: t.bgCard, borderBottomWidth: 1, borderBottomColor: t.border, paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, flexDirection: 'row', alignItems: 'center' }}
          onClick={() => Taro.navigateTo({ url: `/pages/merchant/merchantDetail?id=${item.merchantId}` })}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ ...fs(16), color: t.textPrimary }}>{item.merchantName}</Text>
            <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 4 }}>
              {item.companyName ? `${item.companyName} · ` : ''}浏览 {item.viewCount} 次 · {formatTime(item.viewedAt)}
            </Text>
          </View>
          <View style={{ padding: 10, opacity: busyId === item.merchantId ? 0.4 : 1 }} onClick={() => { if (busyId !== item.merchantId) onDelete(item, 'merchant') }}>
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
