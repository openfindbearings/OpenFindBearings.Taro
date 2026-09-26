// 寻货详情页（v1.7.19）：需求全文 + 分级应答视图 + 选定/取消/应答操作 + 联系方式解锁展示。
// 可见性分级（防报价泄露）：发布人见全部应答明细可比价；商户只见自己的应答；
// 匿名/他人只见应答数。联系方式在"选定"后对双方解锁（发布人见商户电话/被选商户见需求人手机）
// RN 约束：仅 flex、无 fixed/vh、Text 包裹、样式数值
import { useState } from 'react'
import { View, Text, ScrollView, Input } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import Icon from '../../components/Icon'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import { showConfirmDialog } from '../../components/ConfirmDialog'
import { useAuthStore } from '../../stores/auth'
import { useMerchantStore } from '../../stores/merchant'
import { vibrateSuccess } from '../../utils/haptics'
import {
  getSourcingDetail, respondDemand, selectResponse, cancelDemand,
  parseNeedPoints, demandStatusText, responseStatusText, getSourcingQuota, getMyOffering,
  DEMAND_STATUS, RESPONSE_STATUS,
  type SourcingDetail, type RespondDemandBody, type SourcingQuota,
} from '../../services/sourcing'

// 编译期配置：禁用外层 ScrollView，滚动由页内统一提供
definePageConfig({ disableScroll: true })

/** 应答状态色：待处理灰/已选定主色/未选中浅灰 */
function responseColor(status: number, t: Record<string, string>): string {
  if (status === RESPONSE_STATUS.adopted) return t.primary
  if (status === RESPONSE_STATUS.notSelected) return t.textTertiary
  return t.textSecondary
}

/** 寻货详情页 */
export default function SourcingDetailPage() {
  const t = useTheme()
  const fs = useFs()
  const router = useRouter()
  const id = router.params.id || ''
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const currentMerchant = useMerchantStore((s) => s.currentMerchant())
  const [detail, setDetail] = useState<SourcingDetail | null>(null)
  const [busy, setBusy] = useState(false)
  // 应答表单展开态（商户视角）
  const [respondOpen, setRespondOpen] = useState(false)
  const [rPrice, setRPrice] = useState('')
  const [rStock, setRStock] = useState('')
  const [rLead, setRLead] = useState('')
  const [rRemark, setRRemark] = useState('')
  // 改动说明（v1.7.21 额度可见化）：应答额度前置展示（商户维度），失败静默——
  // NEED_POINTS 撞墙协议仍是最终兜底
  const [quota, setQuota] = useState<SourcingQuota | null>(null)
  // 预填来源提示（v1.7.21）：非空时表单顶部显示"已取自在售商品"行
  const [prefilledFrom, setPrefilledFrom] = useState<string | null>(null)

  const load = async () => {
    const d = await getSourcingDetail(id)
    setDetail(d ?? null)
    // 回填自己商户既有应答（更新语义）
    if (d?.myResponse) {
      setRPrice(d.myResponse.price != null ? String(d.myResponse.price) : '')
      setRStock(d.myResponse.stock || '')
      setRLead(d.myResponse.leadTime || '')
      setRRemark(d.myResponse.remark || '')
    }
  }
  useDidShow(() => {
    void load()
    if (isLoggedIn) {
      getSourcingQuota().then(setQuota).catch(() => { /* 额度条隐藏 */ })
    }
  })

  if (!detail) {
    return (
      <PageLayout nav={<NavBar title='寻货详情' onBack={() => Taro.navigateBack()} showBack />}>
        <View style={{ display: 'flex', flexDirection: 'column', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ ...fs(14), color: t.textTertiary }}>加载中…</Text>
        </View>
      </PageLayout>
    )
  }

  const isOpen = detail.status === DEMAND_STATUS.published

  /** 复制联系方式（解锁后的电话） */
  const copyContact = (value: string) => {
    Taro.setClipboardData({ data: value })
  }

  /** 发布人：选定应答（确认弹窗→调用→刷新） */
  const doSelect = async (responseId: string, merchantName?: string | null) => {
    const ok = await showConfirmDialog({
      title: '选定这家应答',
      content: `选定「${merchantName || '该商户'}」后本次寻货结束，双方互见联系方式，其余应答标记为未选中。确认选定？`,
      confirmText: '确认选定',
    })
    if (!ok || busy) return
    setBusy(true)
    const r = await selectResponse(detail.id, responseId)
    setBusy(false)
    if (r.success) {
      void vibrateSuccess()
      Taro.showToast({ title: '已选定，联系方式已解锁', icon: 'success' })
      await load()
    } else {
      Taro.showToast({ title: r.message || '选定失败', icon: 'none' })
    }
  }

  /** 发布人：取消寻货 */
  const doCancel = async () => {
    const ok = await showConfirmDialog({
      title: '取消寻货',
      content: '取消后寻货关闭，已应答的商户会收到通知。确认取消？',
      confirmText: '确认取消',
    })
    if (!ok || busy) return
    setBusy(true)
    const r = await cancelDemand(detail.id)
    setBusy(false)
    if (r.success) {
      Taro.showToast({ title: '已取消', icon: 'success' })
      await load()
    } else {
      Taro.showToast({ title: r.message || '取消失败', icon: 'none' })
    }
  }

  /** 展开应答表单并预填在售同款（v1.7.21）：已有应答不覆盖手改内容 */
  const openRespond = async (): Promise<void> => {
    setRespondOpen(true)
    if (detail.myResponse) return
    const off = await getMyOffering(detail.bearingId || null, detail.partNumber)
    if (!off || !off.found) return
    // 仅填当前为空的字段（用户可能已抢先输入）
    if (off.price != null) setRPrice((v) => v || String(off.price))
    else if (off.priceDescription) setRPrice((v) => v || off.priceDescription!)
    setRStock((v) => v || off.stock || '')
    if (off.isRestocking) {
      setRLead((v) => v || `补货中，预计${off.restockEta || '近期'}到货`)
    }
    setPrefilledFrom(off.isRestocking ? '补货中商品' : '在售商品')
  }

  /** 商户：提交应答（NEED_POINTS 协议自动确认后重提交） */
  const doRespond = async (usePoints: boolean): Promise<void> => {
    if (!rRemark.trim()) {
      Taro.showToast({ title: '请填写应答说明', icon: 'none' })
      return
    }
    if (busy) return
    setBusy(true)
    const body: RespondDemandBody = {
      price: rPrice.trim() ? Number(rPrice.trim()) : null,
      stock: rStock.trim() || null,
      leadTime: rLead.trim() || null,
      remark: rRemark.trim(),
      usePoints,
    }
    const r = await respondDemand(detail.id, body)
    setBusy(false)
    if (r.success) {
      void vibrateSuccess()
      setRespondOpen(false)
      Taro.showToast({ title: '应答成功', icon: 'success' })
      await load()
      return
    }
    const needPoints = parseNeedPoints(r.message)
    if (needPoints !== null) {
      const ok = await showConfirmDialog({
        title: '今日免费应答额度已用完',
        content: `继续应答需花费 ${needPoints} 积分，确认应答？`,
        confirmText: '花积分应答',
      })
      if (ok) await doRespond(true)
      return
    }
    Taro.showToast({ title: r.message || '应答失败', icon: 'none' })
  }

  /** 表单行 */
  const rField = (label: string, value: string, setValue: (v: string) => void, placeholder: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, borderBottomWidth: 1, borderBottomColor: t.border }}>
      <Text style={{ ...fs(14), color: t.textSecondary, width: 64 }}>{label}</Text>
      <Input style={{ ...fs(15), flex: 1, color: t.textPrimary }} placeholder={placeholder} placeholderTextColor={t.textTertiary} value={value} onInput={(e) => setValue(e.detail.value)} />
    </View>
  )

  const rows: [string, string | null | undefined][] = [
    ['期望品牌', detail.brand],
    ['需求数量', detail.quantity],
    ['期望交期', detail.expectedDelivery],
    ['收货地区', detail.region],
  ]

  return (
    <PageLayout nav={<NavBar title='寻货详情' onBack={() => Taro.navigateBack()} showBack />}>
      <ScrollView style={{ flex: 1 }}>
        {/* 需求卡 */}
        <View style={{ margin: 12, paddingLeft: 16, paddingRight: 16, paddingTop: 16, paddingBottom: 16, backgroundColor: t.bgCard, borderRadius: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ ...fs(20), color: t.textPrimary, fontWeight: 'bold', flex: 1 }} numberOfLines={1}>
              寻 {detail.partNumber}
            </Text>
            <View style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2, borderRadius: 8, backgroundColor: isOpen ? t.primaryLight : t.bgInput }}>
              <Text style={{ ...fs(12), color: isOpen ? t.primary : t.textTertiary }}>{demandStatusText(detail.status)}</Text>
            </View>
          </View>
          {rows.filter(([, v]) => v).map(([k, v]) => (
            <View key={k} style={{ flexDirection: 'row', marginTop: 10 }}>
              <Text style={{ ...fs(13), color: t.textTertiary, width: 72 }}>{k}</Text>
              <Text style={{ ...fs(13), color: t.textPrimary, flex: 1 }}>{v}</Text>
            </View>
          ))}
          {detail.description ? (
            <View style={{ marginTop: 10 }}>
              <Text style={{ ...fs(13), color: t.textTertiary }}>补充说明</Text>
              <Text style={{ ...fs(13), color: t.textPrimary, marginTop: 2, lineHeight: 20 }}>{detail.description}</Text>
            </View>
          ) : null}
          <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 10 }}>
            {detail.responseCount} 家应答 · 发布 {new Date(detail.createdAt).toLocaleDateString('zh-CN')}
          </Text>
        </View>

        {/* 发布人视角：解锁的被选商户联系方式 */}
        {detail.isPublisher && detail.selectedMerchantContact ? (
          <View style={{ marginLeft: 12, marginRight: 12, marginBottom: 8, paddingLeft: 14, paddingRight: 14, paddingTop: 14, paddingBottom: 14, backgroundColor: t.primaryLight, borderRadius: 12, flexDirection: 'row', alignItems: 'center' }}>
            <Icon name='phone' size={18} color={t.primary} />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={{ ...fs(13), color: t.textPrimary }}>已选定商户联系电话</Text>
              <Text style={{ ...fs(16), color: t.primary, fontWeight: '600', marginTop: 2 }}>{detail.selectedMerchantContact}</Text>
            </View>
            <Text style={{ ...fs(13), color: t.primary }} onClick={() => copyContact(detail.selectedMerchantContact || '')}>复制</Text>
          </View>
        ) : null}

        {/* 被选商户视角：解锁的发布人手机号 */}
        {detail.myResponse?.status === RESPONSE_STATUS.adopted && detail.publisherContact ? (
          <View style={{ marginLeft: 12, marginRight: 12, marginBottom: 8, paddingLeft: 14, paddingRight: 14, paddingTop: 14, paddingBottom: 14, backgroundColor: t.primaryLight, borderRadius: 12, flexDirection: 'row', alignItems: 'center' }}>
            <Icon name='phone' size={18} color={t.primary} />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={{ ...fs(13), color: t.textPrimary }}>需求方联系电话</Text>
              <Text style={{ ...fs(16), color: t.primary, fontWeight: '600', marginTop: 2 }}>{detail.publisherContact}</Text>
            </View>
            <Text style={{ ...fs(13), color: t.primary }} onClick={() => copyContact(detail.publisherContact || '')}>复制</Text>
          </View>
        ) : null}

        {/* 发布人：全部应答列表（比价视图） */}
        {detail.isPublisher && detail.responses && detail.responses.length > 0 && (
          <View style={{ display: 'flex', flexDirection: 'column', margin: 12, marginTop: 4, backgroundColor: t.bgCard, borderRadius: 12, padding: 14 }}>
            <Text style={{ ...fs(15), color: t.textPrimary, fontWeight: '600' }}>商户应答（{detail.responses.length}）</Text>
            {detail.responses.map((r, i) => (
              <View key={r.id} style={{ marginTop: i === 0 ? 10 : 0, paddingTop: i === 0 ? 0 : 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: t.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ ...fs(14), color: t.textPrimary, fontWeight: '500', flex: 1 }} numberOfLines={1}>
                    {r.merchantName || '商户'}
                  </Text>
                  {r.isVerified && (
                    <View style={{ paddingLeft: 6, paddingRight: 6, paddingTop: 1, paddingBottom: 1, borderRadius: 6, backgroundColor: t.primaryLight, marginRight: 6 }}>
                      <Text style={{ ...fs(10), color: t.primary }}>已认证</Text>
                    </View>
                  )}
                  <Text style={{ ...fs(12), color: responseColor(r.status, t as unknown as Record<string, string>) }}>{responseStatusText(r.status)}</Text>
                </View>
                <Text style={{ ...fs(13), color: t.textSecondary, marginTop: 4 }}>
                  {[r.price != null ? `¥${r.price}/只` : null, r.stock ? `库存 ${r.stock}` : null, r.leadTime ? `交期 ${r.leadTime}` : null].filter(Boolean).join(' · ') || '仅留言'}
                </Text>
                <Text style={{ ...fs(13), color: t.textPrimary, marginTop: 2, lineHeight: 19 }}>{r.remark}</Text>
                {isOpen && r.status === RESPONSE_STATUS.pending && (
                  <View
                    style={{ alignSelf: 'flex-end', marginTop: 8, paddingLeft: 14, paddingRight: 14, paddingTop: 5, paddingBottom: 5, borderRadius: 15, backgroundColor: busy ? t.textTertiary : t.primary }}
                    onClick={() => { void doSelect(r.id, r.merchantName) }}
                  >
                    <Text style={{ ...fs(13), color: '#FFFFFF', fontWeight: '600' }}>选定这家</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* 商户视角：我的应答 / 应答表单入口 */}
        {!detail.isPublisher && detail.myResponse && (
          <View style={{ margin: 12, marginTop: 4, paddingLeft: 14, paddingRight: 14, paddingTop: 14, paddingBottom: 14, backgroundColor: t.bgCard, borderRadius: 12 }}>
            <Text style={{ ...fs(15), color: t.textPrimary, fontWeight: '600' }}>
              我的应答 · <Text style={{ ...fs(13), color: responseColor(detail.myResponse.status, t as unknown as Record<string, string>) }}>{responseStatusText(detail.myResponse.status)}</Text>
            </Text>
            <Text style={{ ...fs(13), color: t.textSecondary, marginTop: 4 }}>
              {[detail.myResponse.price != null ? `¥${detail.myResponse.price}/只` : null, detail.myResponse.stock ? `库存 ${detail.myResponse.stock}` : null, detail.myResponse.leadTime ? `交期 ${detail.myResponse.leadTime}` : null].filter(Boolean).join(' · ') || '仅留言'}
            </Text>
            <Text style={{ ...fs(13), color: t.textPrimary, marginTop: 2, lineHeight: 19 }}>{detail.myResponse.remark}</Text>
            {isOpen && detail.myResponse.status === RESPONSE_STATUS.pending && (
              <Text style={{ ...fs(13), color: t.primary, marginTop: 8 }} onClick={() => { void openRespond() }}>修改应答</Text>
            )}
          </View>
        )}

        {/* 商户：发起应答按钮（有当前商户 + 进行中 + 登录） */}
        {isOpen && !detail.isPublisher && isLoggedIn && currentMerchant && !detail.myResponse && (
          <View
            style={{ margin: 12, marginTop: 4, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: t.primary }}
            onClick={() => { void openRespond() }}
          >
            <Text style={{ ...fs(16), color: '#FFFFFF', fontWeight: '600' }}>我要应答</Text>
          </View>
        )}

        {/* 发布人：取消寻货 */}
        {detail.isPublisher && isOpen && (
          <View
            style={{ margin: 12, marginTop: 4, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: t.border }}
            onClick={() => { void doCancel() }}
          >
            <Text style={{ ...fs(15), color: t.textSecondary }}>取消寻货</Text>
          </View>
        )}

        {/* 未登录引导 */}
        {!isLoggedIn && isOpen && (
          <View style={{ margin: 12, paddingLeft: 14, paddingRight: 14, paddingTop: 14, paddingBottom: 14, backgroundColor: t.bgCard, borderRadius: 12, alignItems: 'center' }}>
            <Text style={{ ...fs(13), color: t.textSecondary }}>登录后可发布寻货；商户账号可应答报价</Text>
          </View>
        )}

        {/* 应答表单（内嵌展开） */}
        {respondOpen && (
          <View style={{ margin: 12, marginTop: 4, paddingLeft: 14, paddingRight: 14, paddingTop: 14, paddingBottom: 14, backgroundColor: t.bgCard, borderRadius: 12 }}>
            <Text style={{ ...fs(15), color: t.textPrimary, fontWeight: '600', marginBottom: 4 }}>应答「{detail.partNumber}」</Text>
            {prefilledFrom ? (
              <Text style={{ ...fs(11), color: t.success, marginBottom: 6 }}>已按你的{prefilledFrom}预填，可修改</Text>
            ) : null}
            {/* 应答额度条（v1.7.21 额度可见化，商户维度）：quota 拉取失败整条隐藏 */}
            {quota ? (() => {
              const rq = quota.respond
              const left = Math.max(rq.freeLimit - rq.todayUsed, 0)
              return (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingLeft: 10, paddingRight: 10, paddingTop: 7, paddingBottom: 7, backgroundColor: t.primaryLight, borderRadius: 8 }}>
                  <Text style={{ ...fs(11), color: t.primary }}>
                    {left > 0 ? `商户今日免费应答剩 ${left}/${rq.freeLimit} 条` : '今日免费应答已用完'}
                  </Text>
                  <Text style={{ ...fs(11), color: t.textSecondary }}>
                    {left > 0 ? `用后可花 ${rq.pointsPrice} 积分/条` : `本条花 ${rq.pointsPrice} 积分 · 余额 ${quota.balance}`}
                  </Text>
                </View>
              )
            })() : null}
            {rField('报价', rPrice, setRPrice, '元/只（可空，电话聊也行）')}
            {rField('库存', rStock, setRStock, '如 现货 2000（可空）')}
            {rField('交期', rLead, setRLead, '如 3 天内发货（可空）')}
            {rField('说明', rRemark, setRRemark, '必填：货源/成色/可否验货')}
            <View style={{ flexDirection: 'row', marginTop: 14 }}>
              <View style={{ flex: 1, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: t.border, marginRight: 10 }} onClick={() => setRespondOpen(false)}>
                <Text style={{ ...fs(15), color: t.textSecondary }}>取消</Text>
              </View>
              <View style={{ flex: 1, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: busy ? t.textTertiary : t.primary }} onClick={() => { void doRespond(false) }}>
                <Text style={{ ...fs(15), color: '#FFFFFF', fontWeight: '600' }}>{busy ? '提交中…' : (quota && quota.respond.todayUsed >= quota.respond.freeLimit ? `花  积分应答` : '提交应答')}</Text>
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </PageLayout>
  )
}
