// 发布寻货页（v1.7.19）：发布求购单。
// 改动说明（v2.12.0 商户名义发布）：表单保持纯输入；点"发布"时一步弹窗选身份——
//   归属商户者弹 ActionSheet（商户逐行+个人名义行，取消=中止发布），纯个人用户不打扰；
//   NEED_POINTS 重提交复用已选身份不再弹（全程最多 1 个身份弹窗）
// 改动说明（v1.8.0 公开/邀请）：原"定向询价单商户"升级为发布方式二选一——
//   公开（进大厅 + 通知匹配的认证在售商家）/ 邀请（不进大厅，只通知勾选的有货认证商家）；
//   有 bearingId 时拉在售认证商家清单供勾选（默认全选），从商家行/商家主页进入则只预勾该家
// 额度模型：免费 N 条/天 → 超限返回 NEED_POINTS 协议 → 弹轴承币确认框 → usePoints=true 重提交
// RN 约束：仅 flex、无 fixed/vh、Text 包裹、样式数值
import { useRef, useState } from 'react'
import { View, Text, Input } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import Icon from '../../components/Icon'
import { showConfirmDialog } from '../../components/ConfirmDialog'
import PublishIdentitySheet from '../../components/PublishIdentitySheet'
import { vibrateSuccess } from '../../utils/haptics'
import { useMerchantStore } from '../../stores/merchant'
import { publishDemand, genPublishIdempotencyKey, parseNeedPoints, getSourcingQuota, type PublishDemandBody, type SourcingQuota } from '../../services/sourcing'
import { getAllBearingMerchants, type BearingMerchant } from '../../services/bearing'
import { getObject, removeItem } from '../../utils/storage'

/** 发布寻货跨页预填 storage 键（轴承详情"发布寻货"/"邀请"写入） */
const PREFILL_KEY = 'sourcing_publish_prefill'

// 编译期配置：禁用外层 ScrollView，滚动由页内统一提供
definePageConfig({ disableScroll: true })

/** 表单字段定义（型号必填，其余可选——降低发布门槛保供给密度） */
interface FormState {
  partNumber: string
  brand: string
  quantity: string
  expectedDelivery: string
  region: string
  description: string
}

const EMPTY: FormState = { partNumber: '', brand: '', quantity: '', expectedDelivery: '', region: '', description: '' }

/** 跨页预填上下文（v1.8.0：曝光范围 + 邀请预勾选收件人） */
interface PublishPrefill {
  partNumber?: string
  brand?: string
  bearingId?: string | null
  visibility?: number
  invitedMerchantIds?: string[] | null
}

/** 发布寻货页 */
export default function PublishSourcingPage() {
  const t = useTheme()
  const fs = useFs()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  // 发布幂等键（v1.7.40）：本次页面会话内稳定复用——连续点击与 NEED_POINTS 二次确认共用同一 key，
  // 服务端据此去重（重放返回原单，不重复建单/扣分）；发布成功后轮换，避免把"再次发布"吞成幂等命中
  const idemKeyRef = useRef<string>(genPublishIdempotencyKey())
  // 改动说明（v1.7.21 额度可见化）：额度聚合前置展示（额度条+按钮三态），
  // 拉取失败静默为 null——NEED_POINTS 撞墙协议仍是最终兜底，展示层不承重
  const [quota, setQuota] = useState<SourcingQuota | null>(null)

  // v2.12.0 商户名义发布：提交时弹 sheet 选身份（表单不占行），可发布商户取自登录态 store
  const merchants = useMerchantStore((s) => s.merchants)
  const currentMerchantId = useMerchantStore((s) => s.currentMerchantId)
  const [sheetOpen, setSheetOpen] = useState(false)

  // v1.8.0 公开/邀请：bearingId 贯通（关联平台轴承）；发布方式与收件人勾选
  const [meta, setMeta] = useState<{ bearingId?: string | null }>({})
  const [mode, setMode] = useState<'public' | 'invited'>('public')
  const [prefilled, setPrefilled] = useState(false)
  /** 在售认证商家清单（有 bearingId 才拉；null=无清单：或未携带 bearingId，或拉取失败） */
  const [inviteList, setInviteList] = useState<BearingMerchant[] | null>(null)
  /** 清单拉取失败（v1.8.1）：与"确实无人在售"区分——失败可重试，不误判为无货、不禁用邀请 */
  const [inviteError, setInviteError] = useState(false)
  /** 邀请勾选的收件人（默认全选；从商家行进入则只勾该家） */
  const [checked, setChecked] = useState<string[]>([])
  /** 跨页预填的指定收件人（无 bearingId 清单时仍按此精确邀约，如从商家主页进入） */
  const [preInvited, setPreInvited] = useState<string[]>([])

  useDidShow(() => {
    getSourcingQuota().then(setQuota).catch(() => { /* 未登录/网络失败：隐藏额度条 */ })
    // 预填：从轴承详情"发布寻货"/"邀请"写入的 storage 读取，读完即清（防后续普通进入被脏预填）
    void (async () => {
      const pre = await getObject<PublishPrefill>(PREFILL_KEY)
      if (!pre) return
      setForm((prev) => ({ ...prev, partNumber: pre.partNumber || prev.partNumber, brand: pre.brand || prev.brand }))
      const bearingId = pre.bearingId ?? null
      setMeta({ bearingId })
      const invited = pre.visibility === 1
      setMode(invited ? 'invited' : 'public')
      setPreInvited(pre.invitedMerchantIds ?? [])
      if (bearingId && !invited) {
        // 普通进入但带了 bearingId：拉清单并默认全选（用户可自行取消勾选）
        loadInviteList(bearingId, null)
      } else if (bearingId && invited) {
        // 从商家行/商家主页进入：只预勾选指定的收件人（预填为空则视为"全部匹配"，与普通进入一致）
        const pre2 = pre.invitedMerchantIds && pre.invitedMerchantIds.length > 0 ? pre.invitedMerchantIds : null
        loadInviteList(bearingId, pre2)
      }
      setPrefilled(true)
      await removeItem(PREFILL_KEY)
    })()
  })

  /**
   * 拉取该轴承的在售认证商家清单，供邀请勾选（只列可信来源：已认证商家）。
   * 改动说明（v1.8.1）：逐页拉全量（原只取第一页，部分勾选会静默丢掉未展示的商家）；
   *   失败与"确实无人在售"分开——失败给重试入口且不禁用邀请
   * 改动说明（v1.7.42 修 bug）：不再在客户端排除"当前商户"——发布身份是点发布时才在
   *   身份弹层里选定的，此处无从得知最终以谁名义发布；先排除会导致"该型号只有自己在售"
   *   时清单被清空、邀请被误禁用（提示还写成"没有认证商家在售"，与事实相反）。
   * 改动说明（v1.7.44 自交易封堵）：改为排除"我在职的全部商户"（一人可开多家），
   *   自家店铺不出现在邀请候选里；服务端另有同口径排除与应答守卫兜底，前端过滤只为少一次无效勾选。
   */
  const loadInviteList = (bearingId: string, preselect: string[] | null) => {
    setInviteError(false)
    getAllBearingMerchants(bearingId)
      .then((all) => {
        // 改动说明（v1.7.44）：以商户状态中的数据为准（点发布时身份弹层也是从这里取），避免两处口径不一
        const myIds = new Set(useMerchantStore.getState().merchants.map((m) => m.merchantId))
        const list = all.filter((m) => m.isVerified && !myIds.has(m.merchantId))
        setInviteList(list)
        // preselect 为 null=默认全选；非 null=只勾指定的那些（保持传参顺序，避免下拉顺序漂移）
        setChecked(preselect === null ? list.map((m) => m.merchantId) : list.filter((m) => preselect.includes(m.merchantId)).map((m) => m.merchantId))
      })
      .catch(() => { setInviteList(null); setInviteError(true); setChecked([]) })
  }

  /**
   * 表单字段写入；改动说明（v1.8.1）：型号被手动改写时清空关联轴承——
   *   候选清单与匹配都按原 bearingId 算的，型号改了就不再成立（否则会出现"邀的是 A 型号商家、单上写 B 型号"）
   */
  const setField = (key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (key === 'partNumber' && meta.bearingId) {
      setMeta({ bearingId: null })
      setInviteList(null)
      setInviteError(false)
      setChecked([])
    }
  }

  /** 切换邀请勾选（点行整行触发） */
  const toggleChecked = (merchantId: string) => {
    setChecked((prev) => prev.includes(merchantId) ? prev.filter((x) => x !== merchantId) : [...prev, merchantId])
  }

  /** 邀请全选/全不选（全部勾选等价于"通知全部匹配商家"，提交空数组） */
  const toggleAll = () => {
    if (!inviteList) return
    setChecked((prev) => prev.length === inviteList.length ? [] : inviteList.map((m) => m.merchantId))
  }

  /** 邀请是否可选：有 bearingId 但清单里无认证在售商家时不可邀（改公开） */
  const invitedAvailable = !(meta.bearingId && inviteList !== null && inviteList.length === 0)

  /**
   * 提交入口：身份未定时——纯个人用户直接提交（不打扰）；
   * 归属商户者弹 PublishIdentitySheet（丙方案自绘弹层，logo+全名辨识度），
   * 选定/取消由 sheet 回调驱动 doSubmit；NEED_POINTS 重提交带已选身份不再弹
   */
  const submit = async (usePoints: boolean, merchantId?: string | null) => {
    if (!form.partNumber.trim()) {
      Taro.showToast({ title: '请填写寻货型号', icon: 'none' })
      return
    }
    // 改动说明（v1.8.0 邀请校验）：勾选清单存在时至少勾一家（全不勾会被服务端理解为"全部匹配"，与意图不符）
    if (mode === 'invited' && inviteList !== null && inviteList.length > 0 && checked.length === 0) {
      Taro.showToast({ title: '请至少勾选一家商家，或改为公开', icon: 'none' })
      return
    }
    if (!invitedAvailable && mode === 'invited') {
      Taro.showToast({ title: '当前无认证商家在售该型号，请选公开', icon: 'none' })
      return
    }
    if (merchantId === undefined) {
      if (merchants.length === 0) {
        await doSubmit(usePoints, null)
      } else {
        setSheetOpen(true)
      }
      return
    }
    await doSubmit(usePoints, merchantId)
  }

  /** 实际提交（身份已定） */
  const doSubmit = async (usePoints: boolean, merchantId: string | null) => {
    setSubmitting(true)
    const invited = mode === 'invited'
    // 全部勾选=通知全部匹配商家（提交空数组，服务端按在售匹配口径解析）；部分勾选=精确收件人；
    // 无 bearingId 清单时按预填指定收件人（从商家主页进入即指定该家；无预填则空数组=全部匹配）
    const allChecked = inviteList !== null && inviteList.length > 0 && checked.length === inviteList.length
    const invitedMerchantIds = invited ? (inviteList === null ? preInvited : (allChecked ? [] : checked)) : null
    const body: PublishDemandBody = {
      partNumber: form.partNumber.trim(),
      bearingId: meta.bearingId ?? null,
      brand: form.brand.trim() || null,
      quantity: form.quantity.trim() || null,
      expectedDelivery: form.expectedDelivery.trim() || null,
      region: form.region.trim() || null,
      description: form.description.trim() || null,
      usePoints,
      // v2.12.0 商户名义发布：sheet 选定的商户；个人名义为 null
      merchantId,
      // v1.8.0 公开/邀请：0=公开（进大厅）/ 1=邀请（只推收件人）
      visibility: invited ? 1 : 0,
      invitedMerchantIds,
    }
    const r = await publishDemand(body, idemKeyRef.current)
    setSubmitting(false)
    if (r.success) {
      void vibrateSuccess()
      // 发布成功即轮换幂等键（下次若仍在同一页面重新发布，应是新单而非幂等命中）
      idemKeyRef.current = genPublishIdempotencyKey()
      // 改动说明（v1.8.0）：按发布方式与实际通知家数给差异化反馈——
      //   公开=已通知 N 家并进大厅（无匹配则只进大厅等应答）；邀请=只通知勾选的 N 家（不进大厅）
      const notified = r.data?.recipientMerchantCount ?? 0
      // 改动说明（v1.7.42）：邀请 0 家不再笼统报"已发布邀请"——否则用户以为邀到了实际没人收到
      //   （典型成因：清单里只勾了"自己名下商户"，服务端按发布身份排除自身后收件人为空）
      const title = invited
        ? (notified > 0 ? `已邀请 ${notified} 家认证商家` : '已发布，但无商家可通知（请检查勾选）')
        : (notified > 0 ? `已通知 ${notified} 家认证商家，并进入大厅` : '已进入寻货大厅')
      Taro.showToast({ title, icon: 'none', duration: 1800 })
      setTimeout(() => Taro.navigateBack(), 1000)
      return
    }
    const needPoints = parseNeedPoints(r.message)
    if (needPoints !== null) {
      const ok = await showConfirmDialog({
        title: '今日免费额度已用完',
        content: `继续发布需花费 ${needPoints} 轴承币，确认发布？`,
        confirmText: '花轴承币发布',
      })
      if (ok) await doSubmit(true, merchantId)
      return
    }
    Taro.showToast({ title: r.message || '发布失败', icon: 'none' })
  }

  /** 单行输入字段（label + input 行式布局） */
  const field = (key: keyof FormState, label: string, placeholder: string, required = false) => (
    <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', minHeight: 48, borderStyle: 'solid', borderBottomWidth: 1, borderBottomColor: t.border }}>
      <Text style={{ ...fs(14), color: required ? t.textPrimary : t.textSecondary, width: 76 }}>
        {label}{required ? ' *' : ''}
      </Text>
      <Input
        style={{ ...fs(15), flex: 1, color: t.textPrimary }}
        placeholder={placeholder}
        placeholderTextColor={t.textTertiary}
        value={form[key]}
        onInput={(e) => setField(key, e.detail.value)}
      />
    </View>
  )

  /** 发布方式选项卡（公开 / 邀请） */
  const modeOption = (value: 'public' | 'invited', title: string, desc: string, disabled = false) => {
    const active = mode === value
    const tone = disabled ? t.textTertiary : (active ? t.primary : t.textSecondary)
    return (
      <View
        style={{
          display: 'flex', flexDirection: 'column', flex: 1, marginRight: value === 'public' ? 8 : 0,
          paddingLeft: 10, paddingRight: 10, paddingTop: 9, paddingBottom: 9, borderRadius: 10,
          borderStyle: 'solid', borderWidth: 1, borderColor: disabled ? t.border : (active ? t.primary : t.border),
          backgroundColor: disabled ? t.bgInput : (active ? t.primaryLight : t.bgCard),
        }}
        onClick={() => { if (!disabled) setMode(value) }}
      >
        <Text style={{ ...fs(13), color: tone, fontWeight: '600' }}>{title}</Text>
        <Text style={{ ...fs(10), color: t.textTertiary, marginTop: 3 }}>{desc}</Text>
      </View>
    )
  }

  // 按钮三态推导（v1.7.21）：额度内免费发布 → 超限花轴承币 → 余额不足去赚分
  const pq = quota?.publish
  const freeLeft = pq ? Math.max(pq.freeLimit - pq.todayUsed, 0) : null
  const overFree = !!pq && pq.todayUsed >= pq.freeLimit
  const insufficient = overFree && !!pq && !!quota && quota.balance < pq.pointsPrice

  return (
    <PageLayout nav={<NavBar title='发布寻货' onBack={() => Taro.navigateBack()} showBack />} overlay={
      /* v2.12.0 发布身份选择弹层（丙方案自绘）：选定商户/个人即提交，取消=中止留在表单。
         已移至 PageLayout overlay 根层插槽（RN fixed 非法致崩根治） */
      <PublishIdentitySheet
        visible={sheetOpen}
        items={merchants.map((m) => ({ id: m.merchantId, name: m.merchantName || '未命名商家', logoUrl: m.logoUrl }))}
        currentId={currentMerchantId}
        onPick={(mid) => { setSheetOpen(false); void doSubmit(false, mid) }}
        onClose={() => setSheetOpen(false)}
      />
    }>
      <View>
        {/* 额度条（v1.7.21 额度可见化）：常驻展示今日剩余免费额度与超限单价，
            不再"撞墙才可见"；quota 拉取失败（未登录等）整条隐藏 */}
        {pq && freeLeft !== null ? (
          <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginLeft: 12, marginRight: 12, marginTop: 12, paddingLeft: 12, paddingRight: 12, paddingTop: 9, paddingBottom: 9, backgroundColor: t.primaryLight, borderRadius: 10 }}>
            <Text style={{ ...fs(12), color: t.primary }}>
              {freeLeft > 0 ? `今日免费额度剩 ${freeLeft}/${pq.freeLimit} 条` : `今日免费额度已用完`}
            </Text>
            <Text style={{ ...fs(12), color: t.textSecondary }}>
              {freeLeft > 0 ? `用后可花 ${pq.pointsPrice} 轴承币/条` : `本条花 ${pq.pointsPrice} 轴承币 · 余额 ${quota?.balance ?? 0}`}
            </Text>
          </View>
        ) : null}
        <View style={{ margin: 12, paddingLeft: 14, paddingRight: 14, paddingTop: 14, paddingBottom: 14, backgroundColor: t.bgCard, borderRadius: 12 }}>
          {/* 改动说明（v2.12.0 交互改向）：发布身份不再占表单行——点"发布"时一步弹窗选择
              （归属商户才弹，纯个人直接提交），表单保持纯输入、逐步引导完成流程 */}
          {/* v1.8.0 搜索寻货联动：来自轴承详情的预填提示（邀请则加注只通知所选商家） */}
          {prefilled ? (
            <View style={{ display: 'flex', marginBottom: 10, paddingLeft: 10, paddingRight: 10, paddingTop: 8, paddingBottom: 8, backgroundColor: t.primaryLight, borderRadius: 8 }}>
              <Text style={{ ...fs(11), color: t.primary }}>
                已按轴承货源预填，可修改{mode === 'invited' ? '（已选邀请：只通知你在下方勾选的认证商家）' : ''}
              </Text>
            </View>
          ) : null}
          {/* 改动说明（v1.5.0 证据力体系 引导文案）：讲清"填全的价值"——具体需求才能匹配精准报价 */}
          <View style={{ display: 'flex', marginBottom: 10, paddingLeft: 10, paddingRight: 10, paddingTop: 8, paddingBottom: 8, backgroundColor: t.primaryLight, borderRadius: 8 }}>
            <Text style={{ ...fs(11), color: t.primary }}>
              寻货信息越具体，商家报价越贴近：型号必填，品牌/数量/交期/地区尽量填全——商家才知道该报哪个型号的价
            </Text>
          </View>
          {field('partNumber', '型号', '必填，如 6205-2RS / 深沟球轴承', true)}
          {field('brand', '期望品牌', '如 NSK / SKF / HRB（可空）')}
          {field('quantity', '数量', '如 500 套（可空）')}
          {field('expectedDelivery', '期望交期', '如 一周内（可空）')}
          {field('region', '收货地区', '如 河南洛阳（可空）')}
          <View style={{ display: 'flex', flexDirection: 'row', minHeight: 72, paddingTop: 12 }}>
            <Text style={{ ...fs(14), color: t.textSecondary, width: 76 }}>补充说明</Text>
            <Input
              style={{ ...fs(15), flex: 1, color: t.textPrimary }}
              placeholder='成色要求、可否验货等（可空）'
              placeholderTextColor={t.textTertiary}
              value={form.description}
              onInput={(e) => setField('description', e.detail.value)}
            />
          </View>
        </View>

        {/* 发布方式（v1.8.0 公开/邀请）：公开=进大厅人人可应答；邀请=只通知勾选的有货认证商家 */}
        <View style={{ marginLeft: 12, marginRight: 12, paddingLeft: 14, paddingRight: 14, paddingTop: 12, paddingBottom: 12, backgroundColor: t.bgCard, borderRadius: 12 }}>
          <Text style={{ ...fs(13), color: t.textPrimary, fontWeight: '600' }}>发布方式</Text>
          <View style={{ display: 'flex', flexDirection: 'row', marginTop: 8 }}>
            {modeOption('public', '公开', '进寻货大厅，所有商家都能看到并应答')}
            {modeOption('invited', '邀请', '只通知你勾选的有货认证商家，不进大厅', !invitedAvailable)}
          </View>

          {/* 邀请收件人（有 bearingId 时列出在售认证商家供勾选；默认全选） */}
          {mode === 'invited' ? (
            inviteError ? (
              // 改动说明（v1.8.1）：加载失败 ≠ 无人在售——给重试入口，且不因此禁用邀请（服务端仍会按匹配校验）
              <View style={{ marginTop: 8 }}>
                <Text style={{ ...fs(11), color: t.textTertiary }}>
                  商家清单加载失败，可重试；也可直接发布，按型号匹配全部在售认证商家
                </Text>
                <Text
                  style={{ ...fs(12), color: t.primary, marginTop: 6 }}
                  onClick={() => { if (meta.bearingId) loadInviteList(meta.bearingId, null) }}
                >
                  点击重试
                </Text>
              </View>
            ) : inviteList === null ? (
              <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 8 }}>
                {preInvited.length > 0
                  ? '已指定邀请该商家（本型号暂无在售清单，无法逐家勾选）'
                  : '将按型号匹配，邀请所有在售该型号的认证商家（暂无在售清单，无法逐家勾选）'}
              </Text>
            ) : inviteList.length === 0 ? (
              <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 8 }}>
                当前没有可邀请的在售认证商家（自己的店铺不能邀请），请改为公开
              </Text>
            ) : (
              <View style={{ marginTop: 8 }}>
                <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ ...fs(12), color: t.textSecondary }}>
                    通知这些在售认证商家（已选 {checked.length}/{inviteList.length}）
                  </Text>
                  <Text style={{ ...fs(12), color: t.primary }} onClick={toggleAll}>
                    {checked.length === inviteList.length ? '全不选' : '全选'}
                  </Text>
                </View>
                {inviteList.map((m) => (
                  <View
                    key={m.merchantId}
                    style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', minHeight: 40, borderStyle: 'solid', borderBottomWidth: 1, borderBottomColor: t.border }}
                    onClick={() => toggleChecked(m.merchantId)}
                  >
                    <View
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: 8,
                        borderStyle: 'solid', borderWidth: 1, borderColor: checked.includes(m.merchantId) ? t.primary : t.border,
                        backgroundColor: checked.includes(m.merchantId) ? t.primary : t.bgCard,
                      }}
                    >
                      {checked.includes(m.merchantId) ? <Icon name='check' size={11} color='#FFFFFF' /> : null}
                    </View>
                    <Text style={{ ...fs(13), color: t.textPrimary, marginLeft: 8, flex: 1 }}>{m.merchantName}</Text>
                    <Text style={{ ...fs(10), color: t.primary }}>认证</Text>
                  </View>
                ))}
              </View>
            )
          ) : null}
        </View>

        <Text style={{ ...fs(12), color: t.textTertiary, marginLeft: 16, marginRight: 16, marginTop: 8 }}>
          选择公开会进入寻货大厅（人人可应答），并通知有货的认证商家；邀请只通知你勾选的认证商家。发布后可从应答中选定一家，双方互见联系方式；寻货 14 天有效，请留意站内信通知。
        </Text>

        {/* 发布按钮三态（v1.7.21）：免费发布 → 花轴承币发布（额度已用完）→ 轴承币不足去赚（跳任务中心）。
            判定仍以服务端 NEED_POINTS 协议为准，这里只是前置展示与引导 */}
        <View
          style={{
            margin: 16, height: 46, borderRadius: 23, alignItems: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center',
            backgroundColor: submitting ? t.textTertiary : (insufficient ? t.textTertiary : t.primary),
          }}
          onClick={() => {
            if (submitting) return
            if (insufficient) {
              Taro.navigateTo({ url: '/pages/my/tasks' })
              return
            }
            void submit(false)
          }}
        >
          <Text style={{ ...fs(16), color: '#FFFFFF', fontWeight: '600' }}>
            {submitting ? '发布中…' : insufficient ? '轴承币不足，去赚轴承币' : overFree && pq ? `花 ${pq.pointsPrice} 轴承币发布` : (mode === 'invited' ? '发布邀请' : '公开发布')}
          </Text>
        </View>
      </View>
    </PageLayout>
  )
}
