// 我的纠错列表页（v1.7.14）：展示本人提交的纠错及审核结果。
// 条目 = 目标 + 字段 + "原值 → 应改为" diff + 状态徽标（审核中/已采纳/未采纳），
// 被驳回时展示审核意见（与详情页 CorrectionSheet 提交闭环，结果经此页+站内信双触达）。
import { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import Icon from '../../components/Icon'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import { useAuthStore } from '../../stores/auth'
import { getMyCorrections, type CorrectionItem } from '../../services/user'
import { formatTime } from '../../utils/format'

definePageConfig({ disableScroll: true })

const PAGE_SIZE = 20

/** 状态徽标映射（API status：Pending/Approved/Rejected） */
const STATUS_MAP: Record<string, { label: string; color: string }> = {
  Pending: { label: '审核中', color: '#F59E0B' },
  Approved: { label: '已采纳', color: '#10B981' },
  Rejected: { label: '未采纳', color: '#EF4444' }
}

/** 我的纠错页：分页列表，滚动到底加载下一页 */
export default function MyCorrectionsPage() {
  const t = useTheme()
  const fs = useFs()
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const [items, setItems] = useState<CorrectionItem[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const load = (p: number, append: boolean) => {
    if (!isLoggedIn) { setItems([]); return }
    setLoading(true)
    getMyCorrections(p, PAGE_SIZE)
      .then((r) => {
        setItems(append ? [...items, ...(r?.items || [])] : (r?.items || []))
        setTotal(r?.totalCount || 0)
        setPage(p)
      })
      .catch(() => { /* 失败静默，保留已有列表 */ })
      .finally(() => setLoading(false))
  }

  useDidShow(() => { load(1, false) })

  const hasMore = items.length < total

  return (
    <PageLayout nav={<NavBar title="我的纠错" showBack />}>
      <ScrollView
        scrollY
        style={{ flex: 1 }}
        onScrollToLower={() => { if (hasMore && !loading) load(page + 1, true) }}
      >
        {items.length === 0 && !loading && (
          <View style={{ alignItems: 'center', paddingTop: 120 }}>
            <Icon name="edit" size={48} color={t.textTertiary} />
            <Text style={{ ...fs(14), color: t.textTertiary, marginTop: 12 }}>
              {isLoggedIn ? '还没有提交过纠错，在详情页点"纠错"帮助我们改进数据' : '登录后查看我提交的纠错'}
            </Text>
          </View>
        )}
        {items.map((item) => {
          const st = STATUS_MAP[item.status] || STATUS_MAP.Pending
          return (
            <View key={item.id} style={{ backgroundColor: t.bgCard, borderRadius: 12, marginLeft: 12, marginRight: 12, marginTop: 10, padding: 14 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ ...fs(15), color: t.textPrimary }} numberOfLines={1}>
                  {item.targetDisplay || (item.targetType === 'Bearing' ? '轴承' : '商家')}
                </Text>
                <View style={{ backgroundColor: `${st.color}22`, borderRadius: 10, paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2 }}>
                  <Text style={{ ...fs(12), color: st.color }}>{st.label}</Text>
                </View>
              </View>
              <Text style={{ ...fs(13), color: t.textSecondary, marginTop: 6 }}>{item.fieldDisplayName}</Text>
              {/* diff 行：原值删除线 → 建议值加粗 */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
                <Text style={{ ...fs(13), color: t.textTertiary, textDecoration: 'line-through' }}>
                  {item.originalValue || '（空）'}
                </Text>
                <Text style={{ ...fs(13), color: t.textTertiary, marginLeft: 6, marginRight: 6 }}>→</Text>
                <Text style={{ ...fs(13), color: t.primary }}>{item.suggestedValue}</Text>
              </View>
              {item.status === 'Rejected' && item.reviewComment && (
                <Text style={{ ...fs(12), color: '#EF4444', marginTop: 6 }}>驳回原因：{item.reviewComment}</Text>
              )}
              <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 6 }}>{formatTime(item.submittedAt)}</Text>
            </View>
          )
        })}
        {loading && (
          <Text style={{ ...fs(13), color: t.textTertiary, textAlign: 'center', paddingTop: 12, paddingBottom: 24 }}>加载中...</Text>
        )}
        {!loading && hasMore && items.length > 0 && (
          <Text style={{ ...fs(13), color: t.textTertiary, textAlign: 'center', paddingTop: 12, paddingBottom: 24 }} onClick={() => load(page + 1, true)}>
            上拉或点击加载更多
          </Text>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>
    </PageLayout>
  )
}
