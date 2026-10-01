// 寻货详情页（v1.7.19）：需求全文 + 分级应答视图 + 选定/取消/应答操作 + 联系方式解锁展示。
// 可见性分级（防报价泄露）：发布人见全部应答明细可比价；商户只见自己的应答；
// 匿名/他人只见应答数。联系方式在"选定"后对双方解锁（发布人见商户电话/被选商户见需求人手机）
// RN 约束：仅 flex、无 fixed/vh、Text 包裹、样式数值
import { useState } from 'react'
import { View, Text, Input, ScrollView } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import Icon from '../../components/Icon'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import { showConfirmDialog } from '../../components/ConfirmDialog'
// 改动说明（v1.7.19 真机修复）：发布日期原用 toLocaleDateString('zh-CN')，
//   Android 微信 JSCore 无 Intl 会回落英文串，统一改走 utils/format
import { formatDate } from '../../utils/format'
import { useAuthStore } from '../../stores/auth'
import { useMerchantStore } from '../../stores/merchant'
import { vibrateSuccess } from '../../utils/haptics'
import {
  getSourcingDetail, respondDemand, selectResponse, cancelDemand,
  parseNeedPoints, demandStatusText, responseStatusText, getSourcingQuota, getMyOffering,
  DEMAND_STATUS, RESPONSE_STATUS,
  type SourcingDetail, type RespondDemandBody, type RespondItemInput, type SourcingQuota,
} from '../../services/sourcing'
// 改动说明（v1.5.0 多行标书）：应答表单支持"从我的在售选择"引用商品填充型号行
import { getMyBearings, type MerchantBearingItem } from '../../services/merchant'

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
  // 改动说明（v1.5.0 多行标书）：单行报价/库存/交期字段改型号行数组——
  // 需求明确时一行（引用在售），需求模糊时商家把自己认为相关的型号挨个列多行
  const [rItems, setRItems] = useState<RespondItemInput[]>([])
  const [rRemark, setRRemark] = useState('')
  // 改动说明（v1.7.21 额度可见化）：应答额度前置展示（商户维度），失败静默——
  // NEED_POINTS 撞墙协议仍是最终兜底
  const [quota, setQuota] = useState<SourcingQuota | null>(null)
  // 预填来源提示（v1.7.21）：非空时表单顶部显示"已取自在售商品"行
  const [prefilledFrom, setPrefilledFrom] = useState<string | null>(null)
  // v1.5.0 从在售选择：展开在售商品列表区（内嵌，非绝对定位，三端安全）
  const [pickOpen, setPickOpen] = useState(false)
  const [onSaleList, setOnSaleList] = useState<MerchantBearingItem[]>([])
  const [pickLoading, setPickLoading] = useState(false)

  const load = async () => {
    const d = await getSourcingDetail(id)
    setDetail(d ?? null)
    // 回填自己商户既有应答（更新语义；v1.5.0 多行标书按行回显）
    if (d?.myResponse) {
      setRItems(d.myResponse.items && d.myResponse.items.length > 0
        ? d.myResponse.items.map((i) => ({
            partNumber: i.partNumber,
            bearingId: i.bearingId ?? null,
            price: i.price ?? null,
            stock: i.stock ?? null,
            leadTime: i.leadTime ?? null,
          }))
        : [])
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

  /** 拨打电话（解锁后的联系方式，电话图标点击直接拨打） */
  const callContact = (phone: string) => {
    if (!phone) return
    Taro.makePhoneCall({ phoneNumber: phone })
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

  /** 展开应答表单并预填在售同款（v1.7.21；v1.5.0 改为多行标书：已有应答/已加行不覆盖手改内容） */
  const openRespond = async (): Promise<void> => {
    setRespondOpen(true)
    if (detail.myResponse) return
    if (rItems.length > 0) return
    const off = await getMyOffering(detail.bearingId || null, detail.partNumber)
    if (!off || !off.found) return
    setRItems([{
      partNumber: detail.partNumber,
      bearingId: detail.bearingId ?? null,
      price: off.price ?? null,
      stock: off.stock || null,
      leadTime: off.isRestocking ? `补货中，预计${off.restockEta || '近期'}到货` : null,
    }])
    setPrefilledFrom(off.isRestocking ? '补货中商品' : '在售商品')
  }

  /** 打开"从我的在售选择"区（内嵌展开）：拉取在售商品列表 */
  const togglePick = async (): Promise<void> => {
    if (pickOpen) {
      setPickOpen(false)
      return
    }
    setPickOpen(true)
    if (onSaleList.length > 0) return
    setPickLoading(true)
    try {
      const r = await getMyBearings({ onlyOnSale: true, pageSize: 50 })
      setOnSaleList(r?.items ?? [])
    } catch {
      setOnSaleList([])
    } finally {
      setPickLoading(false)
    }
  }

  /** 选中一个在售商品 → 追加一行（型号+引用 ID+价格描述解析+库存） */
  const pickOnSale = (b: MerchantBearingItem): void => {
    setRItems((prev) => {
      if (prev.some((i) => i.partNumber === b.bearingPartNumber)) return prev
      return [...prev, {
        partNumber: b.bearingPartNumber,
        bearingId: b.id,
        price: null,
        stock: b.stockDescription || null,
        leadTime: null,
      }]
    })
    setPickOpen(false)
  }

  /** 更新某一行字段 */
  const setRow = (idx: number, patch: Partial<RespondItemInput>): void => {
    setRItems((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)))
  }

  /** 删除某一行 */
  const removeRow = (idx: number): void => {
    setRItems((prev) => prev.filter((_, i) => i !== idx))
  }

  /** 商户：提交应答（v1.5.0 多行标书；NEED_POINTS 协议自动确认后重提交） */
  const doRespond = async (usePoints: boolean): Promise<void> => {
    if (rItems.length === 0) {
      Taro.showToast({ title: '请至少填写一个型号', icon: 'none' })
      return
    }
    if (rItems.some((i) => !i.partNumber.trim())) {
      Taro.showToast({ title: '每个型号行都必须填写型号', icon: 'none' })
      return
    }
    if (!rRemark.trim()) {
      Taro.showToast({ title: '请填写应答说明', icon: 'none' })
      return
    }
    if (busy) return
    setBusy(true)
    const body: RespondDemandBody = {
      items: rItems.map((i) => ({
        partNumber: i.partNumber.trim(),
        bearingId: i.bearingId ?? null,
        price: i.price ?? null,
        stock: i.stock?.trim() || null,
        leadTime: i.leadTime?.trim() || null,
      })),
      remark: rRemark.trim(),
      usePoints,
    }
    const r = await respondDemand(detail.id, body)
    setBusy(false)
    if (r.success) {
      void vibrateSuccess()
      setRespondOpen(false)
      setPrefilledFrom(null)
      Taro.showToast({ title: '应答成功', icon: 'success' })
      await load()
      return
    }
    const needPoints = parseNeedPoints(r.message)
    if (needPoints !== null) {
      const ok = await showConfirmDialog({
        title: '今日免费应答额度已用完',
        content: `继续应答需花费 ${needPoints} 轴承币，确认应答？`,
        confirmText: '花轴承币应答',
      })
      if (ok) await doRespond(true)
      return
    }
    Taro.showToast({ title: r.message || '应答失败', icon: 'none' })
  }

  /** 表单行 */
  const rField = (label: string, value: string, setValue: (v: string) => void, placeholder: string) => (
    <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', minHeight: 44, borderBottomWidth: 1, borderBottomColor: t.border }}>
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
      <View>
        {/* 需求卡 */}
        <View style={{ margin: 12, paddingLeft: 16, paddingRight: 16, paddingTop: 16, paddingBottom: 16, backgroundColor: t.bgCard, borderRadius: 12 }}>
          <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ ...fs(20), color: t.textPrimary, fontWeight: 'bold', flex: 1 }} numberOfLines={1}>
              寻 {detail.partNumber}
            </Text>
            <View style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2, borderRadius: 8, backgroundColor: isOpen ? t.primaryLight : t.bgInput }}>
              <Text style={{ ...fs(12), color: isOpen ? t.primary : t.textTertiary }}>{demandStatusText(detail.status)}</Text>
            </View>
          </View>
          {rows.filter(([, v]) => v).map(([k, v]) => (
            <View key={k} style={{ display: 'flex', flexDirection: 'row', marginTop: 10 }}>
              <Text style={{ ...fs(13), color: t.textTertiary, width: 72 }}>{k}</Text>
              <Text style={{ ...fs(13), color: t.textPrimary, flex: 1 }}>{v}</Text>
            </View>
          ))}
          {detail.description ? (
            <View style={{ marginTop: 10 }}>
              <Text style={{ ...fs(13), color: t.textTertiary }}>补充说明</Text>
              <Text style={{ ...fs(13), color: t.textPrimary, marginTop: 2 }}>{detail.description}</Text>
            </View>
          ) : null}
          <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 10 }}>
            {detail.responseCount} 家应答 · 发布 {formatDate(detail.createdAt)}
          </Text>
        </View>

        {/* 发布人视角：解锁的被选商户联系方式 */}
        {detail.isPublisher && detail.selectedMerchantContact ? (
          <View style={{ marginLeft: 12, marginRight: 12, marginBottom: 8, paddingLeft: 14, paddingRight: 14, paddingTop: 14, paddingBottom: 14, backgroundColor: t.primaryLight, borderRadius: 12, display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ ...fs(13), color: t.textPrimary }}>已选定商户联系电话</Text>
              <Text style={{ ...fs(16), color: t.primary, fontWeight: '600', marginTop: 2 }}>{detail.selectedMerchantContact}</Text>
            </View>
            {/* 改动说明：标题图标与拨打图标重复，删左侧标题图标；右侧改绿色圆形拨打按钮（动作感更明确） */}
            <View
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.success, alignItems: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', marginLeft: 10 }}
              onClick={() => callContact(detail.selectedMerchantContact || '')}
            >
              <Icon name='phone' size={18} color='#FFFFFF' />
            </View>
          </View>
        ) : null}

        {/* 被选商户视角：解锁的发布人手机号 */}
        {detail.myResponse?.status === RESPONSE_STATUS.adopted && detail.publisherContact ? (
          <View style={{ marginLeft: 12, marginRight: 12, marginBottom: 8, paddingLeft: 14, paddingRight: 14, paddingTop: 14, paddingBottom: 14, backgroundColor: t.primaryLight, borderRadius: 12, display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ ...fs(13), color: t.textPrimary }}>需求方联系电话</Text>
              <Text style={{ ...fs(16), color: t.primary, fontWeight: '600', marginTop: 2 }}>{detail.publisherContact}</Text>
            </View>
            {/* 改动说明：与发布人视角卡同款——删左侧标题图标，右侧绿色圆形拨打按钮 */}
            <View
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.success, alignItems: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', marginLeft: 10 }}
              onClick={() => callContact(detail.publisherContact || '')}
            >
              <Icon name='phone' size={18} color='#FFFFFF' />
            </View>
          </View>
        ) : null}

        {/* 发布人：全部应答列表（比价视图；v1.5.0 多行标书 + 实力摘要 + 商户名可点） */}
        {detail.isPublisher && detail.responses && detail.responses.length > 0 && (
          <View style={{ display: 'flex', flexDirection: 'column', margin: 12, marginTop: 4, backgroundColor: t.bgCard, borderRadius: 12, padding: 14 }}>
            <Text style={{ ...fs(15), color: t.textPrimary, fontWeight: '600' }}>商户应答（{detail.responses.length}）</Text>
            <Text style={{ ...fs(11), color: t.textSecondary, marginTop: 2, marginBottom: 8 }}>
              点商户名可看商家主页；应答内容越全、在售凭证越硬，越值得考虑
            </Text>
            {detail.responses.map((r, i) => (
              <View key={r.id} style={{ marginTop: i === 0 ? 0 : 0, paddingTop: i === 0 ? 0 : 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: t.border }}>
                <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                  <Text
                    style={{ ...fs(14), color: t.primary, fontWeight: '500', flex: 1 }}
                    numberOfLines={1}
                    onClick={() => Taro.navigateTo({ url: `/pages/merchant/merchantDetail?id=${r.merchantId}` })}
                  >
                    {r.merchantName || '商户'}
                  </Text>
                  {r.isVerified && (
                    <View style={{ paddingLeft: 6, paddingRight: 6, paddingTop: 1, paddingBottom: 1, borderRadius: 6, backgroundColor: t.primaryLight, marginRight: 6 }}>
                      <Text style={{ ...fs(10), color: t.primary }}>已认证</Text>
                    </View>
                  )}
                  <Text style={{ ...fs(12), color: responseColor(r.status, t as unknown as Record<string, string>) }}>{responseStatusText(r.status)}</Text>
                </View>
                {/* v1.5.0 证据力 P1：商家实力摘要（在售商品数=现货凭证，集体任务达成=历史履约，公司名） */}
                {(r.companyName || (r.onSaleCount ?? 0) > 0 || (r.completedTaskCount ?? 0) > 0) && (
                  <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 3 }}>
                    {[r.companyName, (r.onSaleCount ?? 0) > 0 ? `在售 ${r.onSaleCount} 件` : null, (r.completedTaskCount ?? 0) > 0 ? `集体任务达成 ${r.completedTaskCount} 次` : null].filter(Boolean).join(' · ')}
                  </Text>
                )}
                {/* v1.5.0 多行标书：应答型号行（发布人逐行挑依据，引用在售的亮现货凭证） */}
                <View style={{ marginTop: 6 }}>
                  {r.items && r.items.length > 0 ? (
                    r.items.map((it, j) => (
                      <View key={`${it.id}-${j}`} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
                        <Text style={{ ...fs(13), color: t.textPrimary, fontWeight: '500', flexShrink: 1 }} numberOfLines={1}>{it.partNumber}</Text>
                        {it.bearingId && (
                          <Text style={{ ...fs(10), color: t.success, marginLeft: 6, flexShrink: 0 }}>在售凭证</Text>
                        )}
                        <Text style={{ ...fs(11), color: t.textTertiary, marginLeft: 8, flexShrink: 0 }}>
                          {[it.price != null ? `¥${it.price}/只` : null, it.stock ? `库存 ${it.stock}` : null, it.leadTime ? `交期 ${it.leadTime}` : null].filter(Boolean).join(' · ') || '可详谈'}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={{ ...fs(12), color: t.textTertiary, marginBottom: 3 }}>仅留言（未列型号）</Text>
                  )}
                </View>
                <Text style={{ ...fs(12), color: t.textSecondary, marginTop: 2 }}>{r.remark}</Text>
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

        {/* 商户视角：我的应答 / 应答表单入口（v1.5.0 多行标书回显） */}
        {!detail.isPublisher && detail.myResponse && (
          <View style={{ margin: 12, marginTop: 4, paddingLeft: 14, paddingRight: 14, paddingTop: 14, paddingBottom: 14, backgroundColor: t.bgCard, borderRadius: 12 }}>
            <Text style={{ ...fs(15), color: t.textPrimary, fontWeight: '600' }}>
              我的应答 · <Text style={{ ...fs(13), color: responseColor(detail.myResponse.status, t as unknown as Record<string, string>) }}>{responseStatusText(detail.myResponse.status)}</Text>
            </Text>
            {detail.myResponse.items && detail.myResponse.items.length > 0 && (
              <View style={{ marginTop: 6 }}>
                {detail.myResponse.items.map((it, j) => (
                  <View key={`${it.id}-${j}`} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
                    <Text style={{ ...fs(13), color: t.textPrimary, fontWeight: '500', flexShrink: 1 }} numberOfLines={1}>{it.partNumber}</Text>
                    {it.bearingId && (
                      <Text style={{ ...fs(10), color: t.success, marginLeft: 6, flexShrink: 0 }}>在售凭证</Text>
                    )}
                    <Text style={{ ...fs(11), color: t.textTertiary, marginLeft: 8, flexShrink: 0 }}>
                      {[it.price != null ? `¥${it.price}/只` : null, it.stock ? `库存 ${it.stock}` : null, it.leadTime ? `交期 ${it.leadTime}` : null].filter(Boolean).join(' · ') || '可详谈'}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            <Text style={{ ...fs(13), color: t.textSecondary, marginTop: 2 }}>{detail.myResponse.remark}</Text>
            {isOpen && detail.myResponse.status === RESPONSE_STATUS.pending && (
              <Text style={{ ...fs(13), color: t.primary, marginTop: 8 }} onClick={() => { void openRespond() }}>修改应答</Text>
            )}
          </View>
        )}

        {/* 商户：发起应答按钮（有当前商户 + 进行中 + 登录） */}
        {isOpen && !detail.isPublisher && isLoggedIn && currentMerchant && !detail.myResponse && (
          <View
            style={{ margin: 12, marginTop: 4, height: 46, borderRadius: 23, alignItems: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', backgroundColor: t.primary }}
            onClick={() => { void openRespond() }}
          >
            <Text style={{ ...fs(16), color: '#FFFFFF', fontWeight: '600' }}>我要应答</Text>
          </View>
        )}

        {/* 发布人：取消寻货 */}
        {detail.isPublisher && isOpen && (
          <View
            style={{ margin: 12, marginTop: 4, height: 44, borderRadius: 22, alignItems: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderWidth: 1, borderColor: t.border }}
            onClick={() => { void doCancel() }}
          >
            <Text style={{ ...fs(15), color: t.textSecondary }}>取消寻货</Text>
          </View>
        )}

        {/* 未登录引导 */}
        {!isLoggedIn && isOpen && (
          <View style={{ margin: 12, paddingLeft: 14, paddingRight: 14, paddingTop: 14, paddingBottom: 14, backgroundColor: t.bgCard, borderRadius: 12, display: 'flex', alignItems: 'center' }}>
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
            {/* 改动说明（v1.5.0 证据力体系 引导文案）：讲清"为什么填全"，引导多提供内容辅助流程 */}
            <View style={{ display: 'flex', marginBottom: 8, paddingLeft: 10, paddingRight: 10, paddingTop: 8, paddingBottom: 8, backgroundColor: t.primaryLight, borderRadius: 8 }}>
              <Text style={{ ...fs(11), lineHeight: 17, color: t.primary }}>
                报价要素填全 = 发布人选你的概率更高。型号列得越全越容易被选中；写清货源/成色、报价/库存/交期，就是一份可信的标书
              </Text>
            </View>
            {/* 应答额度条（v1.7.21 额度可见化，商户维度）：quota 拉取失败整条隐藏 */}
            {quota ? (() => {
              const rq = quota.respond
              const left = Math.max(rq.freeLimit - rq.todayUsed, 0)
              return (
                <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingLeft: 10, paddingRight: 10, paddingTop: 7, paddingBottom: 7, backgroundColor: t.primaryLight, borderRadius: 8 }}>
                  <Text style={{ ...fs(11), color: t.primary }}>
                    {left > 0 ? `商户今日免费应答剩 ${left}/${rq.freeLimit} 条` : '今日免费应答已用完'}
                  </Text>
                  <Text style={{ ...fs(11), color: t.textSecondary }}>
                    {left > 0 ? `用后可花 ${rq.pointsPrice} 轴承币/条` : `本条花 ${rq.pointsPrice} 轴承币 · 余额 ${quota.balance}`}
                  </Text>
                </View>
              )
            })() : null}
            {/* 型号行编辑器（v1.5.0 多行标书）：每行=型号+报价/库存/交期，可引用在售商品 */}
            {rItems.map((row, idx) => (
              <View key={idx} style={{ marginBottom: 8, padding: 10, borderWidth: 1, borderColor: t.border, borderRadius: 8 }}>
                <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                  <Input
                    style={{ ...fs(14), flex: 1, color: t.textPrimary, minHeight: 40 }}
                    value={row.partNumber}
                    placeholder={`型号 ${idx + 1}，如 6205-2RS`}
                    placeholderTextColor={t.textTertiary}
                    onInput={(e) => setRow(idx, { partNumber: e.detail.value })}
                  />
                  {rItems.length > 1 && (
                    <Text style={{ ...fs(12), color: t.textTertiary, marginLeft: 8 }} onClick={() => removeRow(idx)}>删除</Text>
                  )}
                </View>
                <View style={{ display: 'flex', flexDirection: 'row', marginTop: 6 }}>
                  <Input
                    style={{ ...fs(13), flex: 1, color: t.textPrimary, minHeight: 36, marginRight: 6, backgroundColor: t.bgInput, borderRadius: 6, paddingLeft: 8, paddingRight: 8 }}
                    value={row.price != null ? String(row.price) : ''}
                    placeholder='报价 元/只'
                    placeholderTextColor={t.textTertiary}
                    onInput={(e) => setRow(idx, { price: e.detail.value.trim() === '' || Number.isNaN(Number(e.detail.value)) ? null : Number(e.detail.value) })}
                  />
                  <Input
                    style={{ ...fs(13), flex: 1, color: t.textPrimary, minHeight: 36, marginLeft: 6, backgroundColor: t.bgInput, borderRadius: 6, paddingLeft: 8, paddingRight: 8 }}
                    value={row.stock || ''}
                    placeholder='库存'
                    placeholderTextColor={t.textTertiary}
                    onInput={(e) => setRow(idx, { stock: e.detail.value })}
                  />
                </View>
                <Input
                  style={{ ...fs(13), color: t.textPrimary, minHeight: 36, marginTop: 6, backgroundColor: t.bgInput, borderRadius: 6, paddingLeft: 8, paddingRight: 8 }}
                  value={row.leadTime || ''}
                  placeholder='交期（可选）'
                  placeholderTextColor={t.textTertiary}
                  onInput={(e) => setRow(idx, { leadTime: e.detail.value })}
                />
                {row.bearingId ? (
                  <Text style={{ ...fs(10), color: t.success, marginTop: 4 }}>已引用在售商品（发布人可见现货凭证）</Text>
                ) : null}
              </View>
            ))}
            {/* 操作行：添加型号 / 从在售选择 */}
            <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <View
                style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', paddingLeft: 12, paddingRight: 12, paddingTop: 5, paddingBottom: 5, borderRadius: 14, borderWidth: 1, borderColor: t.primary, marginRight: 10 }}
                onClick={() => setRItems((prev) => [...prev, { partNumber: '', bearingId: null, price: null, stock: null, leadTime: null }])}
              >
                <Text style={{ ...fs(12), color: t.primary }}>+ 添加型号</Text>
              </View>
              <View
                style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', paddingLeft: 12, paddingRight: 12, paddingTop: 5, paddingBottom: 5, borderRadius: 14, borderWidth: 1, borderColor: t.border }}
                onClick={() => { void togglePick() }}
              >
                <Text style={{ ...fs(12), color: t.textSecondary }}>{pickOpen ? '收起在售' : '从我的在售选择'}</Text>
              </View>
            </View>
            {/* 在售商品选择区（内嵌展开，非绝对定位——三端一致） */}
            {pickOpen && (
              <ScrollView scrollY style={{ maxHeight: 180, marginBottom: 8 }} {...({ showsVerticalScrollIndicator: false } as any)}>
                {pickLoading ? (
                  <Text style={{ ...fs(12), color: t.textTertiary, paddingVertical: 8 }}>加载在售商品中…</Text>
                ) : onSaleList.length === 0 ? (
                  <Text style={{ ...fs(12), color: t.textTertiary, paddingVertical: 8 }}>暂无在售商品，可先去商品管理上架，或手动填写型号</Text>
                ) : (
                  onSaleList.map((b) => (
                    <View
                      key={b.id}
                      style={{ borderBottomWidth: 1, borderBottomColor: t.border, paddingTop: 7, paddingBottom: 7 }}
                      onClick={() => pickOnSale(b)}
                    >
                      <Text style={{ ...fs(13), color: t.textPrimary }}>{b.bearingPartNumber}</Text>
                      <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 2 }}>
                        {[b.brandName, b.stockDescription, b.priceDescription].filter(Boolean).join(' · ') || '—'}
                      </Text>
                    </View>
                  ))
                )}
              </ScrollView>
            )}
            {rField('说明', rRemark, setRRemark, '必填：货源/成色/可否验货')}
            <View style={{ display: 'flex', flexDirection: 'row', marginTop: 14 }}>
              <View style={{ flex: 1, height: 42, borderRadius: 21, alignItems: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderWidth: 1, borderColor: t.border, marginRight: 10 }} onClick={() => setRespondOpen(false)}>
                <Text style={{ ...fs(15), color: t.textSecondary }}>取消</Text>
              </View>
              <View style={{ flex: 1, height: 42, borderRadius: 21, alignItems: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', backgroundColor: busy ? t.textTertiary : t.primary }} onClick={() => { void doRespond(false) }}>
                <Text style={{ ...fs(15), color: '#FFFFFF', fontWeight: '600' }}>{busy ? '提交中…' : (quota && quota.respond.todayUsed >= quota.respond.freeLimit ? `花  轴承币应答` : '提交应答')}</Text>
              </View>
            </View>
          </View>
        )}

        <View style={{ height: 30 }} />
      </View>
    </PageLayout>
  )
}
