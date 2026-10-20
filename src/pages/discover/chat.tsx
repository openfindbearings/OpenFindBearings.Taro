// 撮合会话页（v2.18.0 T1 会话）：绑定"寻货单 × 商户"的聚焦式对话，
// 供需双方在选定前/后均可就这一单沟通（问库存、问交期、议价），寻货结束后会话只读保留。
// 入口：寻货详情"会话"按钮、我的寻货/商家应答列表、消息中心会话 tab。
// RN 约束：仅 flex、无 fixed/vh/CSS 变量、Text 包裹、lineHeight 数值、滚动区固定高度
import { useState } from 'react'
import { View, Text, Input, ScrollView } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import NavBar from '../../components/NavBar'
import PageLayout from '../../platforms/PageLayout'
import LoginGuide from '../../components/LoginGuide'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import { useAuthStore } from '../../stores/auth'
import {
  getConversationMessages, sendConversationMessage, markConversationRead,
  type SourcingMessages,
} from '../../services/sourcing'

definePageConfig({ disableScroll: true })

/** 撮合会话页 */
export default function SourcingChatPage() {
  const t = useTheme()
  const fs = useFs()
  const router = useRouter()
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const demandId = router.params.demandId || ''
  const merchantId = router.params.merchantId || ''
  const [data, setData] = useState<SourcingMessages | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  // 改动说明（v1.7.42 会话分页）：服务层早有 before 游标，页面此前只拉首批 30 条导致早期对话不可见
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  /** 滚动锚点（最后一条消息 id；RN/H5 均可就地滚到底部） */
  const [anchor, setAnchor] = useState('')
  const [scrollTop, setScrollTop] = useState(0)
  /** 消息区固定高度（RN ScrollView 需确定高度，故按窗口高度折算） */
  const winH = (() => {
    try {
      return Taro.getSystemInfoSync().windowHeight || 640
    } catch {
      return 640
    }
  })()

  const load = async () => {
    try {
      const d = await getConversationMessages(demandId, merchantId)
      setData(d)
      setHasMore(d.hasMore)
      if (d.messages.length > 0) {
        setAnchor(`msg-${d.messages[d.messages.length - 1].id}`)
      }
      // 进入即标记已读（清未读角标）
      if ((d.conversationId ?? '') !== '') void markConversationRead(demandId, merchantId)
    } catch {
      setData(null)
    }
  }

  /**
   * 上翻历史：以当前最早一条的 createdAt 为 before 游标拉上一页并前插。
   * 改动说明（v1.7.42）：拉取期间置 loadingMore 防重复点击；失败保留已有消息并提示重试
   */
  const loadEarlier = async () => {
    if (!data || data.messages.length === 0 || loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const before = data.messages[0].createdAt
      const r = await getConversationMessages(demandId, merchantId, before)
      setHasMore(r.hasMore)
      setData({ ...data, messages: [...r.messages, ...data.messages] })
    } catch {
      Taro.showToast({ title: '更早消息加载失败', icon: 'none' })
    } finally {
      setLoadingMore(false)
    }
  }

  useDidShow(() => {
    void load()
  })

  const doSend = async () => {
    const content = text.trim()
    if (!content || busy) return
    setBusy(true)
    const r = await sendConversationMessage(demandId, merchantId, content)
    setBusy(false)
    if (r.success) {
      setText('')
      await load()
      setScrollTop((v) => v + 100000)
    } else {
      Taro.showToast({ title: r.message || '发送失败', icon: 'none' })
    }
  }

  const title = data?.role === 'merchant' ? '与需求方沟通' : '与商户沟通'

  if (!isLoggedIn) {
    return (
      <PageLayout nav={<NavBar title='会话' onBack={() => Taro.navigateBack()} showBack />}>
        <LoginGuide icon='message-circle' text='登录后可与对方沟通' />
      </PageLayout>
    )
  }

  return (
    <PageLayout nav={<NavBar title={title} onBack={() => Taro.navigateBack()} showBack />}>
      <View style={{ display: 'flex', flexDirection: 'column', flex: 1, height: winH - 100 }}>
        {/* 单据快照条（避免脱离上下文） */}
        {data ? (
          <View style={{ paddingLeft: 14, paddingRight: 14, paddingTop: 8, paddingBottom: 8, backgroundColor: t.bgInput }}>
            <Text style={{ ...fs(11), color: t.textTertiary }} numberOfLines={1}>
              {data.readOnly ? '寻货已结束 · 会话只读保留' : '就本次寻货沟通（勿发无关广告）'}
            </Text>
          </View>
        ) : null}

        <ScrollView scrollY scrollIntoView={anchor} scrollTop={scrollTop} style={{ flex: 1, height: winH - 200, paddingLeft: 12, paddingRight: 12 }}>
          {/* 上翻历史入口（v1.7.42）：仅还有更早消息时出现 */}
          {hasMore ? (
            <View style={{ paddingTop: 10, display: 'flex', alignItems: 'center' }} onClick={() => { void loadEarlier() }}>
              <Text style={{ ...fs(12), color: t.primary }}>{loadingMore ? '加载中…' : '查看更早消息'}</Text>
            </View>
          ) : null}
          {data && data.messages.length === 0 ? (
            <View style={{ padding: 24, display: 'flex', alignItems: 'center' }}>
              <Text style={{ ...fs(13), color: t.textTertiary }}>还没有消息，先打个招呼说明你能供的型号与交期</Text>
            </View>
          ) : null}
          {(data?.messages ?? []).map((m) => (
            <View key={m.id} id={`msg-${m.id}`} style={{ display: 'flex', flexDirection: 'row', justifyContent: m.mine ? 'flex-end' : 'flex-start', marginTop: 10 }}>
              <View style={{ maxWidth: '78%', paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, borderRadius: 12, backgroundColor: m.mine ? t.primary : t.bgCard }}>
                <Text style={{ ...fs(14), color: m.mine ? '#FFFFFF' : t.textPrimary, lineHeight: 20 }}>{m.content}</Text>
              </View>
            </View>
          ))}
          <View style={{ height: 12 }} />
        </ScrollView>

        {/* 输入区（只读态隐藏） */}
        {data && !data.readOnly ? (
          <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 12, borderTopWidth: 1, borderTopColor: t.border }}>
            <Input
              style={{ flex: 1, ...fs(14), color: t.textPrimary, minHeight: 40, backgroundColor: t.bgInput, borderRadius: 20, paddingLeft: 14, paddingRight: 14 }}
              value={text}
              placeholder='输入消息…'
              maxlength={2000}
              confirmType='send'
              onInput={(e) => setText(e.detail.value)}
              onConfirm={() => { void doSend() }}
            />
            <View
              style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 9, paddingBottom: 9, borderRadius: 20, backgroundColor: busy || !text.trim() ? t.textTertiary : t.primary, marginLeft: 8 }}
              onClick={() => { void doSend() }}
            >
              <Text style={{ ...fs(14), color: '#FFFFFF', fontWeight: '600' }}>发送</Text>
            </View>
          </View>
        ) : null}
        {!data ? (
          <View style={{ padding: 24, display: 'flex', alignItems: 'center' }}>
            <Text style={{ ...fs(13), color: t.textTertiary }}>加载中…</Text>
          </View>
        ) : null}
      </View>
    </PageLayout>
  )
}
