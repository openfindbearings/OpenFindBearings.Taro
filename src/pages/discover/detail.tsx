// 寻货详情页（v1.7.19）：需求全文 + 分级应答视图 + 选定/取消/应答/撤销操作 + 联系方式解锁展示。
// 可见性分级（防报价泄露）：发布人见全部应答明细可比价；商户只见自己的应答；
// 匿名/他人只见应答数。
// 改动说明（v2.18.0 电话单向 + 成交回执）：选定后仅需求方获得商家联系电话（商家看不到需求方号码，
// 双方沟通走站内会话 pages/discover/chat）；需求方可对被选定合作回填"是否谈成"（影响商家卡级）。
// v1.5.0 应答独立页：应答表单迁往 respond.tsx，本页只剩"我要应答/修改应答"跳入口与"取消应答"撤销。
// RN 约束：仅 flex、无 fixed/vh、Text 包裹、样式数值
import { useState } from 'react'
import { View, Text, Input } from '@tarojs/components'
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
// v2.12.0 等级玩法铭牌曝光：应答经办人段位彩牌色带
import { getLevelBand, getMerchantGradeBand, MERCHANT_GRADE_LABELS } from '../../utils/level'
import { useAuthStore } from '../../stores/auth'
import { useMerchantStore } from '../../stores/merchant'
import { vibrateSuccess } from '../../utils/haptics'
import {
  getSourcingDetail, selectResponse, cancelDemand, cancelMyResponse, publishDemandAsPublic,
  submitDealFeedback, demandStatusText, responseStatusText, dealOutcomeText,
  DEMAND_STATUS, RESPONSE_STATUS, DEAL_OUTCOME, DEAL_NEGATIVE_OUTCOMES,
  type SourcingDetail,
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
  /** 加载失败/无权查看（v1.8.1）：邀请单对非受邀者返回 404，原实现静默失败致页面永远"加载中" */
  const [loadError, setLoadError] = useState(false)
  const [busy, setBusy] = useState(false)
  // 改动说明（v1.7.42 回执补原因）：选中的负回执原因（点选后展开说明框，提交前可改）
  const [fbDraft, setFbDraft] = useState<number | null>(null)
  const [fbReason, setFbReason] = useState('')
  // 改动说明（v1.5.0 应答独立页）：应答表单整体迁往 pages/discover/respond.tsx，
  // 本页回归纯阅读/比价 + 应答/修改/撤销入口，不再持有应答编辑状态

  const load = async () => {
    try {
      const d = await getSourcingDetail(id)
      setDetail(d ?? null)
      setLoadError(false)
    } catch {
      // 改动说明（v1.8.1）：区分终态——无权查看/已删除给出明确提示与返回入口，不再无限"加载中"
      setDetail(null)
      setLoadError(true)
    }
  }
  useDidShow(() => {
    void load()
  })

  if (!detail) {
    return (
      <PageLayout nav={<NavBar title='寻货详情' onBack={() => Taro.navigateBack()} showBack />}>
        <View style={{ display: 'flex', flexDirection: 'column', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ ...fs(14), color: t.textTertiary }}>{loadError ? '寻货不存在或无权查看' : '加载中…'}</Text>
          {loadError ? (
            <Text style={{ ...fs(14), color: t.primary, marginTop: 14 }} onClick={() => Taro.navigateBack()}>
              返回
            </Text>
          ) : null}
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

  // 改动说明（v2.18.0 电话单向）：原"被选商户联系需求方"弹窗已删——
  //   商家在任何情况下都拿不到需求方号码，双方沟通改走站内会话

  /** 进入撮合会话（v2.18.0 T1：绑定"寻货单 × 商户"，双方均可进入） */
  const goChat = (merchantId?: string | null) => {
    if (!merchantId) return
    Taro.navigateTo({ url: `/pages/discover/chat?demandId=${detail.id}&merchantId=${merchantId}` })
  }

  /**
   * 发布人：提交成交回执（v2.18.0 撮合成交链）。
   * 谈成=计一次成功撮合（推商家升卡）；没谈成按原因记负信号；均只由需求方单方填写
   * 改动说明（v1.7.42）：补"原因"入参——负回执可选说明，"其他情况"必填（否则该回执零信息）
   */
  const doFeedback = async (outcome: number, reason?: string) => {
    if (busy || !detail.selectedResponseId) return
    const text = (reason ?? '').trim()
    if (outcome === DEAL_OUTCOME.other && !text) {
      Taro.showToast({ title: '选“其他情况”请补充说明', icon: 'none' })
      return
    }
    if (outcome !== DEAL_OUTCOME.confirmed) {
      const name = dealOutcomeText(outcome)
      const ok = await showConfirmDialog({
        title: '记录未谈成',
        content: `记下"${name}"后，该商户本次不计成功撮合。若已谈成请改选"谈成了"。确认提交？`,
        confirmText: '确认',
      })
      if (!ok) return
    }
    setBusy(true)
    const r = await submitDealFeedback(detail.selectedResponseId, outcome, text || null)
    setBusy(false)
    if (r.success) {
      const counted = r.data?.counted
      // 改动说明（v1.7.42 修 bug）：未计分原因取 note（原误用 message 恒空），如实告知为何没算
      const note = r.data?.note
      Taro.showToast({
        title: outcome === DEAL_OUTCOME.confirmed
          ? (counted ? '已记录，成交 +1' : (note ? `已记录：${note}` : '已记录（本次未计分）'))
          : '已记录',
        icon: 'none',
      })
      setFbDraft(null)
      setFbReason('')
      await load()
    } else {
      Taro.showToast({ title: r.message || '提交失败', icon: 'none' })
    }
  }

  /** 发布人：选定应答（确认弹窗→调用→刷新） */
  const doSelect = async (responseId: string, merchantName?: string | null) => {
    const ok = await showConfirmDialog({
      title: '选定这家应答',
      content: `选定「${merchantName || '该商户'}」后本次寻货结束，你将获得该商户联系电话（对方看不到你的号码），其余应答标记为未选中。确认选定？`,
      confirmText: '确认选定',
    })
    if (!ok || busy) return
    setBusy(true)
    const r = await selectResponse(detail.id, responseId)
    setBusy(false)
    if (r.success) {
      void vibrateSuccess()
      Taro.showToast({ title: '已选定，可查看对方联系方式', icon: 'success' })
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

  /**
   * 发布人：把进行中的邀请单转为公开（v1.8.1）。
   * 改动说明：免去"邀请无人应答只能取消重建"的额度与积分损耗（与"我的寻货/商户工作台"列表入口同义，
   *   详情页就地可操作）
   */
  const doPublishPublic = async () => {
    const ok = await showConfirmDialog({
      title: '转为公开',
      content: '转为公开后，寻货将进入公开大厅、所有商家可见可应答；原邀请收件人名单不再保留。确认转为公开？',
      confirmText: '确认转公开',
    })
    if (!ok || busy) return
    setBusy(true)
    const r = await publishDemandAsPublic(detail.id)
    setBusy(false)
    if (r.success) {
      Taro.showToast({ title: '已转为公开', icon: 'success' })
      await load()
    } else {
      Taro.showToast({ title: r.message || '转为公开失败', icon: 'none' })
    }
  }

  /** 进入应答独立页（新建=我要应答 / 已有=修改应答，respond 页自行拉详情回显） */
  const goRespond = (): void => {
    Taro.navigateTo({ url: `/pages/discover/respond?id=${detail.id}` })
  }

  /** 商户：撤销自己的待处理应答（确认→DELETE→刷新；额度不回退） */
  const doCancelResponse = async (): Promise<void> => {
    const ok = await showConfirmDialog({
      title: '撤销应答',
      content: '撤销后该需求不再展示你的报价，需求方回到未应答状态；可重新应答，当日免费额度不退还。确认撤销？',
      confirmText: '确认撤销',
    })
    if (!ok || busy) return
    setBusy(true)
    const r = await cancelMyResponse(detail.id)
    setBusy(false)
    if (r.success) {
      void vibrateSuccess()
      Taro.showToast({ title: '应答已撤销', icon: 'success' })
      await load()
    } else {
      Taro.showToast({ title: r.message || '撤销失败', icon: 'none' })
    }
  }

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
            {/* 改动说明（v1.8.1）：邀请单徽章——受邀商家从通知点进来需立刻知道"这是点名邀我的单、受众 N 家" */}
            {detail.isPrivate ? (
              <View style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2, borderRadius: 8, backgroundColor: t.bgInput, marginLeft: 6 }}>
                <Text style={{ ...fs(11), color: t.textSecondary }}>邀请 {detail.invitedCount ?? 0} 家</Text>
              </View>
            ) : null}
          </View>
          {/* 改动说明（v2.12.0 商户名义发布）：商户单显示"商户发布"行，商户名可点进商家主页看全貌 */}
          {detail.publisherType === 'merchant' && detail.publisherMerchantId ? (
            <View
              style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginTop: 8 }}
              onClick={() => Taro.navigateTo({ url: `/pages/merchant/merchantDetail?id=${detail.publisherMerchantId}` })}
            >
              <View style={{ paddingLeft: 8, paddingRight: 8, paddingTop: 2, paddingBottom: 2, borderRadius: 8, backgroundColor: t.primaryLight, marginRight: 8 }}>
                <Text style={{ ...fs(11), color: t.primary }}>商户发布</Text>
              </View>
              <Text style={{ ...fs(13), color: t.primary, fontWeight: '500', flex: 1 }} numberOfLines={1}>
                {detail.publisherMerchantName} ›
              </Text>
            </View>
          ) : null}
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

        {/* 发布人视角：被选商户联系方式 + 进入会话（v2.18.0 电话单向：只有需求方拿到商家号码） */}
        {detail.isPublisher && detail.selectedMerchantContact ? (
          <View style={{ marginLeft: 12, marginRight: 12, marginBottom: 8, paddingLeft: 14, paddingRight: 14, paddingTop: 14, paddingBottom: 14, backgroundColor: t.primaryLight, borderRadius: 12, display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ ...fs(13), color: t.textPrimary }}>已选定商户联系电话</Text>
              <Text style={{ ...fs(16), color: t.primary, fontWeight: '600', marginTop: 2 }}>{detail.selectedMerchantContact}</Text>
            </View>
            {/* 改动说明（v2.18.0 会话入口）：电话之外补站内会话，便于留痕沟通 */}
            <View
              style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, borderRadius: 18, backgroundColor: t.bgCard, marginLeft: 10 }}
              onClick={() => {
                const adopted = detail.responses?.find((x) => x.id === detail.selectedResponseId)
                goChat(adopted?.merchantId)
              }}
            >
              <Text style={{ ...fs(12), color: t.primary, fontWeight: '600' }}>会话</Text>
            </View>
            <View
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.success, alignItems: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', marginLeft: 10 }}
              onClick={() => callContact(detail.selectedMerchantContact || '')}
            >
              <Icon name='phone' size={18} color='#FFFFFF' />
            </View>
          </View>
        ) : null}

        {/* 发布人视角：成交回执（v2.18.0 撮合成交链：一键三选，谈成推商家卡级） */}
        {detail.isPublisher && detail.canFeedback && detail.selectedResponseId ? (
          <View style={{ marginLeft: 12, marginRight: 12, marginBottom: 8, padding: 14, backgroundColor: t.bgCard, borderRadius: 12 }}>
            <Text style={{ ...fs(14), color: t.textPrimary, fontWeight: '600' }}>这次合作谈成了吗？</Text>
            <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 2 }}>
              {detail.myFeedback
                ? `已记录：${dealOutcomeText(detail.myFeedback.outcome)}${detail.myFeedback.counted ? '（已计成功撮合）' : (detail.myFeedback.note ? `（未计分：${detail.myFeedback.note}）` : '（本次未计分）')}，可重新选择覆盖`
                : '谈成会计一次该商户的成功撮合（帮靠谱商家升级）；没谈成按原因记下，不惩罚你'}
            </Text>
            <View style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
              <View
                style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, borderRadius: 18, backgroundColor: detail.myFeedback?.outcome === DEAL_OUTCOME.confirmed ? t.primary : t.bgInput, marginRight: 10, marginBottom: 8 }}
                onClick={() => { void doFeedback(DEAL_OUTCOME.confirmed) }}
              >
                <Text style={{ ...fs(13), color: detail.myFeedback?.outcome === DEAL_OUTCOME.confirmed ? '#FFFFFF' : t.textPrimary, fontWeight: '600' }}>谈成了</Text>
              </View>
              {DEAL_NEGATIVE_OUTCOMES.map((o) => (
                <View
                  key={o}
                  style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 8, borderRadius: 18, backgroundColor: (fbDraft ?? detail.myFeedback?.outcome) === o ? t.textSecondary : t.bgInput, marginRight: 10, marginBottom: 8 }}
                  // 改动说明（v1.7.42）：负回执先展开原因框再提交，不再点一下立刻落库（避免误触且可填说明）
                  onClick={() => { setFbDraft(o); setFbReason(o === detail.myFeedback?.outcome ? (detail.myFeedback?.reason ?? '') : '') }}
                >
                  <Text style={{ ...fs(13), color: (fbDraft ?? detail.myFeedback?.outcome) === o ? '#FFFFFF' : t.textSecondary }}>{dealOutcomeText(o)}</Text>
                </View>
              ))}
            </View>
            {/* 负回执说明（可选；选"其他情况"时必填）——提交按钮只在展开原因框时出现 */}
            {fbDraft != null ? (
              <View style={{ marginTop: 2 }}>
                <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingLeft: 10, paddingRight: 10, backgroundColor: t.bgInput, borderRadius: 10 }}>
                  <Input
                    style={{ ...fs(13), flex: 1, color: t.textPrimary }}
                    placeholder={fbDraft === DEAL_OUTCOME.other ? '请说明情况（必填）' : '补充说明（可空）'}
                    placeholderTextColor={t.textTertiary}
                    value={fbReason}
                    onInput={(e) => setFbReason(e.detail.value)}
                  />
                </View>
                <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
                  <View
                    style={{ paddingLeft: 14, paddingRight: 14, paddingTop: 7, paddingBottom: 7, borderRadius: 16, backgroundColor: t.bgInput, marginRight: 8 }}
                    onClick={() => { setFbDraft(null); setFbReason('') }}
                  >
                    <Text style={{ ...fs(12), color: t.textSecondary }}>取消</Text>
                  </View>
                  <View
                    style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 7, paddingBottom: 7, borderRadius: 16, backgroundColor: t.textSecondary }}
                    onClick={() => { void doFeedback(fbDraft, fbReason) }}
                  >
                    <Text style={{ ...fs(12), color: '#FFFFFF', fontWeight: '600' }}>提交</Text>
                  </View>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* 被选商户视角：v2.18.0 电话单向——看不到需求方号码，只提示"买家已获取你的联系方式"并给会话入口 */}
        {detail.myResponse?.status === RESPONSE_STATUS.adopted ? (
          <View style={{ marginLeft: 12, marginRight: 12, marginBottom: 8, paddingLeft: 14, paddingRight: 14, paddingTop: 14, paddingBottom: 14, backgroundColor: t.primaryLight, borderRadius: 12, display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ ...fs(13), color: t.textPrimary }}>已选定你的应答</Text>
              <Text style={{ ...fs(12), color: t.textSecondary, marginTop: 2 }}>
                {detail.contactUnlockedAt ? '买家已获取你的联系方式' : '买家可查看你的联系方式'}；出于保护买家，你无法看到对方号码，请用站内会话沟通
              </Text>
            </View>
            <View
              style={{ paddingLeft: 12, paddingRight: 12, paddingTop: 8, paddingBottom: 8, borderRadius: 18, backgroundColor: t.bgCard, marginLeft: 10 }}
              onClick={() => goChat(currentMerchant?.merchantId)}
            >
              <Text style={{ ...fs(12), color: t.primary, fontWeight: '600' }}>会话</Text>
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
                  {/* v2.12.0 等级玩法铭牌曝光：经办人段位彩牌（真人信任信号，发布人比价参考） */}
                  <View style={{ paddingLeft: 6, paddingRight: 6, paddingTop: 1, paddingBottom: 1, borderRadius: 6, backgroundColor: getLevelBand(r.responderLevel).bg, marginRight: 6 }}>
                    <Text style={{ ...fs(10), color: '#FFFFFF', fontWeight: '600' }}>Lv.{r.responderLevel ?? 1} {r.responderLevelName ?? ''}</Text>
                  </View>
                  {r.isVerified && (
                    <View style={{ paddingLeft: 6, paddingRight: 6, paddingTop: 1, paddingBottom: 1, borderRadius: 6, backgroundColor: t.primaryLight, marginRight: 6 }}>
                      <Text style={{ ...fs(10), color: t.primary }}>已认证</Text>
                    </View>
                  )}
                  {/* 改动说明（v1.7.42 双徽章并列）：商家卡级彩牌与"已认证"并列（认证=类型、卡级=等级） */}
                  {(r.merchantGrade ?? 0) >= 1 && (
                    <View style={{ paddingLeft: 6, paddingRight: 6, paddingTop: 1, paddingBottom: 1, borderRadius: 6, backgroundColor: getMerchantGradeBand(r.merchantGrade).bg, marginRight: 6 }}>
                      <Text style={{ ...fs(10), color: '#FFFFFF', fontWeight: '600' }}>{r.merchantGradeDisplay || MERCHANT_GRADE_LABELS[r.merchantGrade ?? 0]}</Text>
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
              <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
                <View
                  style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', paddingLeft: 14, paddingRight: 14, paddingTop: 7, paddingBottom: 7, borderRadius: 16, backgroundColor: t.primary, marginRight: 10 }}
                  onClick={() => goRespond()}
                >
                  <Text style={{ ...fs(13), color: '#FFFFFF', fontWeight: '600' }}>修改应答</Text>
                </View>
                <View
                  style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', paddingLeft: 14, paddingRight: 14, paddingTop: 7, paddingBottom: 7, borderRadius: 16, borderWidth: 1, borderColor: t.border }}
                  onClick={() => { void doCancelResponse() }}
                >
                  <Text style={{ ...fs(13), color: t.textSecondary }}>取消应答</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* 商户：发起应答按钮（有当前商户 + 进行中 + 登录；v1.5.0 跳应答独立页） */}
        {isOpen && !detail.isPublisher && isLoggedIn && currentMerchant && !detail.myResponse && (
          <View
            style={{ margin: 12, marginTop: 4, height: 46, borderRadius: 23, alignItems: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', backgroundColor: t.primary }}
            onClick={() => goRespond()}
          >
            <Text style={{ ...fs(16), color: '#FFFFFF', fontWeight: '600' }}>我要应答</Text>
          </View>
        )}

        {/* 发布人：取消寻货 + 邀请单可转为公开（v1.8.1；与列表入口同义，详情页就地可操作） */}
        {detail.isPublisher && isOpen && (
          <View style={{ display: 'flex', flexDirection: 'row', margin: 12, marginTop: 4 }}>
            {detail.isPrivate ? (
              <View
                style={{ flex: 1, height: 44, borderRadius: 22, alignItems: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', backgroundColor: t.primary, marginRight: 10 }}
                onClick={() => { void doPublishPublic() }}
              >
                <Text style={{ ...fs(15), color: '#FFFFFF', fontWeight: '600' }}>转为公开</Text>
              </View>
            ) : null}
            <View
              style={{ flex: 1, height: 44, borderRadius: 22, alignItems: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderWidth: 1, borderColor: t.border }}
              onClick={() => { void doCancel() }}
            >
              <Text style={{ ...fs(15), color: t.textSecondary }}>取消寻货</Text>
            </View>
          </View>
        )}

        {/* 未登录引导 */}
        {!isLoggedIn && isOpen && (
          <View style={{ margin: 12, paddingLeft: 14, paddingRight: 14, paddingTop: 14, paddingBottom: 14, backgroundColor: t.bgCard, borderRadius: 12, display: 'flex', alignItems: 'center' }}>
            <Text style={{ ...fs(13), color: t.textSecondary }}>登录后可发布寻货；商户账号可应答报价</Text>
          </View>
        )}

        <View style={{ height: 30 }} />
      </View>
    </PageLayout>
  )
}
