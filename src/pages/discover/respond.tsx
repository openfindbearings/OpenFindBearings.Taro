// 应答寻货页（v1.5.0 多行标书单页竖流）：需求摘要钉顶 + 型号行卡片编辑器（卡内"从在售选择"联动过滤）+
// 虚线添加行 + 空态引导 + 自动预填 + 重复型号去重 + 配额降噪 + 整份说明 + 提交。
// 设计决策（单页竖流，非分步向导）：多行标书是清单式录入（重复同构行+少量全局字段），
// 强制分步会把"填第 2 行对着第 1 行改"的反复对照动作割裂；用分区+空态压信息密度。
// 招投标类比"开标前撤标"的撤销入口在详情页"我的应答"卡上，本页只管报价。
// RN 约束：仅 flex、无 fixed、Text 包裹、lineHeight 数值
import { useState } from 'react'
import { View, Text, Input } from '@tarojs/components'
import Taro, { useDidShow, useRouter } from '@tarojs/taro'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import { showConfirmDialog } from '../../components/ConfirmDialog'
import { useAuthStore } from '../../stores/auth'
import { vibrateSuccess } from '../../utils/haptics'
import {
  getSourcingDetail, respondDemand, parseNeedPoints, getSourcingQuota, getMyOffering,
  DEMAND_STATUS,
  type SourcingDetail, type RespondDemandBody, type RespondItemInput, type SourcingQuota,
} from '../../services/sourcing'
import { getMyBearings, type MerchantBearingItem } from '../../services/merchant'

// 编译期配置：禁用外层 ScrollView，滚动由页内统一提供
definePageConfig({ disableScroll: true })

/** 应答寻货页 */
export default function RespondPage() {
  const t = useTheme()
  const fs = useFs()
  const router = useRouter()
  const id = router.params.id || ''
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const [detail, setDetail] = useState<SourcingDetail | null>(null)
  const [busy, setBusy] = useState(false)
  // 型号行数组：每行 型号/引用在售/报价/库存/交期
  const [rItems, setRItems] = useState<RespondItemInput[]>([])
  const [rRemark, setRRemark] = useState('')
  const [quota, setQuota] = useState<SourcingQuota | null>(null)
  // 预填来源提示（v1.7.21）：非空时显示"已按在售同款预填"
  const [prefilledFrom, setPrefilledFrom] = useState<string | null>(null)
  // 卡内从在售选择：展开的卡片下标（null=收起；同一时刻只展开一张）
  const [pickRow, setPickRow] = useState<number | null>(null)
  const [onSaleList, setOnSaleList] = useState<MerchantBearingItem[]>([])
  const [pickLoading, setPickLoading] = useState(false)

  const load = async (): Promise<void> => {
    const d = await getSourcingDetail(id)
    setDetail(d ?? null)
    if (!d) return
    if (d.myResponse) {
      // 修改语义：回显既有应答并按行还原
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
      return
    }
    // 新建语义：需求型号在售有同款则自动预填第一行（少一次点击）
    if (d.bearingId || d.partNumber) {
      const off = await getMyOffering(d.bearingId || null, d.partNumber)
      if (off && off.found) {
        setRItems([{
          partNumber: d.partNumber,
          bearingId: d.bearingId ?? null,
          price: off.price ?? null,
          stock: off.stock || null,
          leadTime: off.isRestocking ? `补货中，预计${off.restockEta || '近期'}到货` : null,
        }])
        setPrefilledFrom(off.isRestocking ? '补货中商品' : '在售商品')
      }
    }
  }
  useDidShow(() => {
    void load()
    if (isLoggedIn) {
      getSourcingQuota().then(setQuota).catch(() => { /* 额度条隐藏，撞墙协议兜底 */ })
    }
  })

  if (!detail) {
    return (
      <PageLayout nav={<NavBar title='应答寻货' onBack={() => Taro.navigateBack()} showBack />}>
        <View style={{ display: 'flex', flexDirection: 'column', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ ...fs(14), color: t.textTertiary }}>加载中…</Text>
        </View>
      </PageLayout>
    )
  }

  const isOpen = detail.status === DEMAND_STATUS.published
  if (!isOpen) {
    return (
      <PageLayout nav={<NavBar title='应答寻货' onBack={() => Taro.navigateBack()} showBack />}>
        <View style={{ display: 'flex', flexDirection: 'column', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ ...fs(14), color: t.textTertiary }}>该寻货已结束，无法应答</Text>
        </View>
      </PageLayout>
    )
  }

  /** 展开/收起某一卡片的在校列表（首次拉取我的在售商品） */
  const togglePick = async (idx: number): Promise<void> => {
    if (pickRow === idx) {
      setPickRow(null)
      return
    }
    setPickRow(idx)
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

  /** 在售列表联动过滤：跟随卡片当前已输入型号关键词 */
  const filteredList = (idx: number): MerchantBearingItem[] => {
    const kw = (rItems[idx]?.partNumber || '').trim().toLowerCase()
    if (!kw) return onSaleList
    return onSaleList.filter((b) => b.bearingPartNumber.toLowerCase().includes(kw))
  }

  /** 从在售选一个填进当前卡（型号+引用+库存；重复型号去重提示不填充） */
  const pickOnSale = (idx: number, b: MerchantBearingItem): void => {
    const dup = rItems.findIndex(
      (row, i) => i !== idx && row.partNumber.toLowerCase() === b.bearingPartNumber.toLowerCase())
    if (dup >= 0) {
      Taro.showToast({ title: `该型号已在第 ${dup + 1} 行报价`, icon: 'none' })
      return
    }
    setRItems((prev) => prev.map((row, i) =>
      i === idx
        ? { ...row, partNumber: b.bearingPartNumber, bearingId: b.id, stock: b.stockDescription || row.stock }
        : row))
    setPickRow(null)
  }

  /** 更新某行字段 */
  const setRow = (idx: number, patch: Partial<RespondItemInput>): void => {
    setRItems((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)))
  }

  /** 删除某行 */
  const removeRow = (idx: number): void => {
    setRItems((prev) => prev.filter((_, i) => i !== idx))
  }

  /** 空态引导：一键按需求型号建行 */
  const addByDemand = (): void => {
    const dup = rItems.some((row) => row.partNumber.toLowerCase() === detail.partNumber.toLowerCase())
    if (dup) {
      Taro.showToast({ title: '该型号已在列表中', icon: 'none' })
      return
    }
    setRItems((prev) => [...prev, { partNumber: detail.partNumber, bearingId: detail.bearingId ?? null, price: null, stock: null, leadTime: null }])
  }

  /** 提交应答（NEED_POINTS 撞墙协议确认后重提交） */
  const doSubmit = async (usePoints: boolean): Promise<void> => {
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
      Taro.showToast({ title: detail.myResponse ? '应答已更新' : '应答成功', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 400)
      return
    }
    const needPoints = parseNeedPoints(r.message)
    if (needPoints !== null) {
      const ok = await showConfirmDialog({
        title: '今日免费应答额度已用完',
        content: `继续应答需花费 ${needPoints} 轴承币，确认应答？`,
        confirmText: '花轴承币应答',
      })
      if (ok) await doSubmit(true)
      return
    }
    Taro.showToast({ title: r.message || '应答失败', icon: 'none' })
  }

  // 配额降噪：充足一行小灰字，不足才放大成醒目条
  const quotaOpen = quota && quota.respond.todayUsed >= quota.respond.freeLimit

  return (
    <PageLayout nav={<NavBar title='应答寻货' onBack={() => Taro.navigateBack()} showBack />}>
      {/* 需求摘要卡（钉顶，先看清题） */}
      <View style={{ margin: 12, paddingLeft: 14, paddingRight: 14, paddingTop: 14, paddingBottom: 14, backgroundColor: t.bgCard, borderRadius: 12 }}>
        <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ flex: 1, ...fs(16), color: t.textPrimary, fontWeight: '600' }}>{detail.partNumber}</Text>
          <Text style={{ ...fs(11), color: t.textSecondary, backgroundColor: t.bgInput, borderRadius: 8, paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2 }}>{detail.responseCount} 家应答</Text>
        </View>
        <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 6 }}>
          {[['型号', detail.partNumber], ['品牌', detail.brand], ['数量', detail.quantity], ['交期', detail.expectedDelivery], ['地区', detail.region]].filter(([, v]) => !!v).map(([k, v]) => `${k}：${v}`).join(' · ') || '需求说明见备注'}
        </Text>
        {detail.description ? (
          <Text style={{ ...fs(12), color: t.textSecondary, marginTop: 6 }}>{detail.description}</Text>
        ) : null}
      </View>

      {/* 预填提示（新建语义且有同款在售时） */}
      {prefilledFrom ? (
        <View style={{ marginLeft: 12, marginRight: 12, marginTop: 4 }}>
          <Text style={{ ...fs(11), color: t.success }}>已按你的{prefilledFrom}预填第一行，可修改</Text>
        </View>
      ) : null}

      {/* 配额降噪条：充足=小灰字；不足=醒目条 */}
      {quota ? (() => {
        const rq = quota.respond
        const left = Math.max(rq.freeLimit - rq.todayUsed, 0)
        if (!quotaOpen) {
          return (
            <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginLeft: 12, marginRight: 12, marginTop: 4 }}>
              <Text style={{ ...fs(11), color: t.textTertiary }}>今日免费应答剩 {left}/{rq.freeLimit} 条</Text>
              <Text style={{ ...fs(11), color: t.textTertiary }}>超额后花 {rq.pointsPrice} 轴承币/条</Text>
            </View>
          )
        }
        return (
          <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', margin: 12, marginTop: 4, paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, backgroundColor: t.primaryLight, borderRadius: 8 }}>
            <Text style={{ ...fs(12), color: t.primary }}>今日免费应答已用完</Text>
            <Text style={{ ...fs(12), color: t.textSecondary }}>本条花 {rq.pointsPrice} 轴承币 · 余额 {quota.balance}</Text>
          </View>
        )
      })() : null}

      {/* 空态引导（无行时显示，不凭空冒空卡） */}
      {rItems.length === 0 && (
        <View style={{ margin: 12, marginTop: 4, padding: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: t.border, borderRadius: 12 }}>
          <Text style={{ ...fs(13), color: t.textSecondary, marginBottom: 4 }}>还没有型号行——先按需求型号建一行，或从我的在售里挑</Text>
          <View
            style={{ alignSelf: 'flex-start', display: 'flex', flexDirection: 'row', alignItems: 'center', paddingLeft: 14, paddingRight: 14, paddingTop: 7, paddingBottom: 7, borderRadius: 16, backgroundColor: t.primary }}
            onClick={() => addByDemand()}
          >
            <Text style={{ ...fs(13), color: '#FFFFFF', fontWeight: '600' }}>＋ 按需求型号报价</Text>
          </View>
        </View>
      )}

      {/* 型号行卡片列表（卡内从在售选择 + 报价/库存/交期） */}
      {rItems.map((row, idx) => (
        <View key={idx} style={{ margin: 12, marginTop: idx === 0 ? 4 : 10, padding: 14, backgroundColor: t.bgCard, borderRadius: 12 }}>
          <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
            <Input
              style={{ flex: 1, ...fs(15), color: t.textPrimary, minHeight: 42 }}
              value={row.partNumber}
              placeholder={`型号 ${idx + 1}，如 6205-2RS`}
              placeholderTextColor={t.textTertiary}
              onInput={(e) => setRow(idx, { partNumber: e.detail.value })}
            />
            <View
              style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6, borderRadius: 14, borderWidth: 1, borderColor: t.border, marginLeft: 8 }}
              onClick={() => { void togglePick(idx) }}
            >
              <Text style={{ ...fs(12), color: pickRow === idx ? t.primary : t.textSecondary }}>{pickRow === idx ? '收起在售' : '从在售选'}</Text>
            </View>
          </View>
          {row.bearingId ? (
            <Text style={{ ...fs(10), color: t.success, marginTop: 2 }}>已引用在售商品（发布人可见现货凭证）</Text>
          ) : null}
          {/* 卡内在售选择区（前 5 条完整渲染 + 更多提示，不嵌裁切滚动） */}
          {pickRow === idx && (
            <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: t.border }}>
              {pickLoading ? (
                <Text style={{ ...fs(12), color: t.textTertiary, paddingTop: 8, paddingBottom: 8 }}>加载在售商品中…</Text>
              ) : filteredList(idx).length === 0 ? (
                <Text style={{ ...fs(12), color: t.textTertiary, paddingTop: 8, paddingBottom: 8 }}>没有匹配的在售商品，可手动填型号或先去商品管理上架</Text>
              ) : (
                <>
                  {filteredList(idx).slice(0, 5).map((b) => (
                    <View
                      key={b.id}
                      style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', paddingTop: 9, paddingBottom: 9, borderBottomWidth: 1, borderBottomColor: t.border }}
                      onClick={() => pickOnSale(idx, b)}
                    >
                      <Text style={{ ...fs(13), color: t.textPrimary, flexShrink: 1 }} numberOfLines={1}>{b.bearingPartNumber}</Text>
                      <Text style={{ ...fs(11), color: t.textTertiary, marginLeft: 8, flexShrink: 0 }}>{b.stockDescription || '在售'}</Text>
                    </View>
                  ))}
                  {filteredList(idx).length > 5 && (
                    <Text style={{ ...fs(11), color: t.textTertiary, paddingTop: 8, paddingBottom: 4 }}>还有更多，输入更精确的型号关键词缩小范围</Text>
                  )}
                </>
              )}
            </View>
          )}
          <View style={{ display: 'flex', flexDirection: 'row', marginTop: 8 }}>
            <Input
              style={{ flex: 1, ...fs(13), color: t.textPrimary, minHeight: 38, backgroundColor: t.bgInput, borderRadius: 8, paddingLeft: 10, paddingRight: 10, marginRight: 6 }}
              type='digit'
              value={row.price != null ? String(row.price) : ''}
              placeholder='报价 元/只'
              placeholderTextColor={t.textTertiary}
              onInput={(e) => setRow(idx, { price: e.detail.value.trim() === '' || Number.isNaN(Number(e.detail.value)) ? null : Number(e.detail.value) })}
            />
            <Input
              style={{ flex: 1, ...fs(13), color: t.textPrimary, minHeight: 38, backgroundColor: t.bgInput, borderRadius: 8, paddingLeft: 10, paddingRight: 10, marginLeft: 6 }}
              value={row.stock || ''}
              placeholder='库存'
              placeholderTextColor={t.textTertiary}
              onInput={(e) => setRow(idx, { stock: e.detail.value })}
            />
          </View>
          <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
            <Input
              style={{ flex: 1, ...fs(13), color: t.textPrimary, minHeight: 38, backgroundColor: t.bgInput, borderRadius: 8, paddingLeft: 10, paddingRight: 10 }}
              value={row.leadTime || ''}
              placeholder='交期（可选）'
              placeholderTextColor={t.textTertiary}
              onInput={(e) => setRow(idx, { leadTime: e.detail.value })}
            />
            {rItems.length > 1 && (
              <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 3 }} onClick={() => removeRow(idx)}>删除</Text>
            )}
          </View>
        </View>
      ))}

      {/* 虚线添加行（最后一张卡之后，主流单据表单形态） */}
      {rItems.length > 0 && (
        <View
          style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', margin: 12, marginTop: 8, paddingTop: 12, paddingBottom: 12, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: t.border }}
          onClick={() => setRItems((prev) => [...prev, { partNumber: '', bearingId: null, price: null, stock: null, leadTime: null }])}
        >
          <Text style={{ ...fs(14), color: t.textSecondary }}>＋ 添加型号</Text>
        </View>
      )}

      {/* 整份说明（必填） */}
      <View style={{ margin: 12, marginTop: 6, paddingLeft: 14, paddingRight: 14, paddingTop: 14, paddingBottom: 14, backgroundColor: t.bgCard, borderRadius: 12 }}>
        <Text style={{ ...fs(14), color: t.textPrimary, fontWeight: '600' }}>应答说明</Text>
        <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 2, marginBottom: 6 }}>必填一句话：货源来源 / 成色 / 是否可验货——发报人以此判断可信度</Text>
        <Input
          style={{ ...fs(14), color: t.textPrimary, minHeight: 40, backgroundColor: t.bgInput, borderRadius: 8, paddingLeft: 10, paddingRight: 10 }}
          value={rRemark}
          placeholder='如：现货正品，支持验货，可开票'
          placeholderTextColor={t.textTertiary}
          onInput={(e) => setRRemark(e.detail.value)}
        />
      </View>

      {/* 提交 */}
      <View
        style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', margin: 12, marginTop: 4, height: 46, borderRadius: 23, backgroundColor: busy ? t.textTertiary : t.primary }}
        onClick={() => { void doSubmit(false) }}
      >
        <Text style={{ ...fs(16), color: '#FFFFFF', fontWeight: '600' }}>
          {busy ? '提交中…' : (detail.myResponse ? '更新应答' : (quotaOpen ? `花 ${quota?.respond.pointsPrice ?? 20} 轴承币应答` : '提交应答'))}
        </Text>
      </View>
      <View style={{ height: 30 }} />
    </PageLayout>
  )
}