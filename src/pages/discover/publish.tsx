// 发布寻货页（v1.7.19）：发布求购单。
// 改动说明（v2.12.0 商户名义发布）：表单保持纯输入；点"发布"时一步弹窗选身份——
//   归属商户者弹 ActionSheet（商户逐行+个人名义行，取消=中止发布），纯个人用户不打扰；
//   NEED_POINTS 重提交复用已选身份不再弹（全程最多 1 个身份弹窗）
// 改动说明（v1.8.0 公开/邀请）：原"定向询价单商户"升级为发布方式二选一——
//   公开（进大厅 + 通知匹配的认证在售商家）/ 邀请（不进大厅，只通知勾选的认证商家）
// 改动说明（v1.7.52 型号联想 + 邀请放宽）：
//   型号输入支持平台型号联想（选中即带 bearingId，解锁精确匹配与有货清单）；
//   未关联型号仍可发布，但明确提示"只进大厅、不定向通知"；
//   邀请候选分两组——有货认证商家（默认全选）+ 其他认证商家（未在售，可找货，默认不勾），
//   邀请口径由"必须在该型号在售"放宽为"认证商家即可"，服务端仍逐家校验认证/启用/非自家
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
import { getAllBearingMerchants, searchBearings, type Bearing, type BearingMerchant } from '../../services/bearing'
import { searchMerchants, type Merchant } from '../../services/merchant'
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

/** 已勾选商家的展示信息（v1.7.52：两组候选与搜索切换后仍能显示名称与是否有货） */
interface CheckedMeta {
  name: string
  hasStock: boolean
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
  /** 邀请勾选的收件人（默认全选有货组；从商家行进入则只勾该家） */
  const [checked, setChecked] = useState<string[]>([])
  /** 勾选商家的名称与是否有货（v1.7.52：两组候选合并勾选后仍能展示已选区） */
  const [checkedMeta, setCheckedMeta] = useState<Record<string, CheckedMeta>>({})
  /** 跨页预填的指定收件人（无 bearingId 清单时仍按此精确邀约，如从商家主页进入） */
  const [preInvited, setPreInvited] = useState<string[]>([])

  // 型号联想（v1.7.52）：≥2 字触发，300ms 防抖，丢弃过期响应
  const [suggestions, setSuggestions] = useState<Bearing[]>([])
  const [suggestLoading, setSuggestLoading] = useState(false)
  /** 已关联型号的展示文案（型号 · 品牌 · 类型） */
  const [linkedLabel, setLinkedLabel] = useState('')
  const suggestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suggestSeqRef = useRef(0)

  // 其他认证商家（未在售该型号，可帮找货；v1.7.52）
  const [showOthers, setShowOthers] = useState(false)
  const [others, setOthers] = useState<Merchant[] | null>(null)
  const [othersLoading, setOthersLoading] = useState(false)
  const [othersKeyword, setOthersKeyword] = useState('')

  useDidShow(() => {
    getSourcingQuota().then(setQuota).catch(() => { /* 未登录/网络失败：隐藏额度条 */ })
    // 预填：从轴承详情"发布寻货"/"邀请"写入的 storage 读取，读完即清（防后续普通进入被脏预填）
    void (async () => {
      const pre = await getObject<PublishPrefill>(PREFILL_KEY)
      if (!pre) return
      setForm((prev) => ({ ...prev, partNumber: pre.partNumber || prev.partNumber, brand: pre.brand || prev.brand }))
      const bearingId = pre.bearingId ?? null
      setMeta({ bearingId })
      // 改动说明（v1.7.52 型号联想）：预填自带 bearingId 时展示"已关联"态，与联想选中后的界面一致
      if (bearingId && pre.partNumber) {
        setLinkedLabel(`${pre.partNumber}${pre.brand ? ' · ' + pre.brand : ''}`)
      }
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
        const picked = preselect === null ? list.map((m) => m.merchantId) : list.filter((m) => preselect.includes(m.merchantId)).map((m) => m.merchantId)
        setChecked(picked)
        // 改动说明（v1.7.52）：同步勾选展示信息，已选区在切换搜索/分组后仍能显示名称
        const metaMap: Record<string, CheckedMeta> = {}
        list.forEach((m) => {
          if (picked.includes(m.merchantId)) metaMap[m.merchantId] = { name: m.merchantName, hasStock: true }
        })
        setCheckedMeta(metaMap)
        // 改动说明（v1.7.52）：预填指定的收件人已并入勾选集合，清空 preInvited，
        //   否则用户取消勾选后提交仍会按旧预填发出，界面与实际收件人不一致
        if (preInvited.length > 0 && preInvited.every((id) => list.some((m) => m.merchantId === id))) {
          setPreInvited([])
        }
        // 改动说明（v1.7.52）：有货清单变化后，"其他认证商家"需重算（要排除已有货的），置空待重载
        setOthers(null)
      })
      .catch(() => { setInviteList(null); setInviteError(true); setChecked([]); setCheckedMeta({}) })
  }

  /**
   * 型号输入：改动说明（v1.7.52 型号联想）——输入即触发联想（≥2 字、300ms 防抖、序号丢弃过期响应）；
   *   手动改写型号会清空关联轴承（候选与匹配都按原 bearingId 算的，型号改了就不再成立）
   */
  const onPartNumberInput = (value: string) => {
    setField('partNumber', value)
    if (linkedLabel) setLinkedLabel('')

    const keyword = value.trim()
    if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current)
    if (keyword.length < 2) {
      suggestSeqRef.current += 1
      setSuggestions([])
      setSuggestLoading(false)
      return
    }

    setSuggestLoading(true)
    const seq = ++suggestSeqRef.current
    suggestTimerRef.current = setTimeout(() => {
      searchBearings({ keyword, pageSize: 8 })
        .then((r) => {
          if (seq !== suggestSeqRef.current) return
          setSuggestions(r.items ?? [])
        })
        .catch(() => { if (seq === suggestSeqRef.current) setSuggestions([]) })
        .finally(() => { if (seq === suggestSeqRef.current) setSuggestLoading(false) })
    }, 300)
  }

  /**
   * 选中联想型号：写入型号与品牌、绑定 bearingId、拉有货认证商家清单
   * 改动说明（v1.7.52）：选中即"已关联"，可直接邀请有货商家；清空旧的勾选避免跨型号残留
   */
  const pickSuggestion = (bearing: Bearing) => {
    if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current)
    suggestSeqRef.current += 1
    setSuggestions([])
    setSuggestLoading(false)

    setForm((prev) => ({ ...prev, partNumber: bearing.partNumber, brand: prev.brand || bearing.brandName || '' }))
    setMeta({ bearingId: bearing.id })
    setLinkedLabel([bearing.partNumber, bearing.brandName, bearing.bearingType].filter(Boolean).join(' · '))
    setChecked([])
    setCheckedMeta({})
    setOthers(null)
    loadInviteList(bearing.id, null)
  }

  /** 取消关联：清空 bearingId 与有货清单，邀请改为手动选择认证商家 */
  const unlinkBearing = () => {
    setMeta({ bearingId: null })
    setLinkedLabel('')
    setInviteList(null)
    setInviteError(false)
    setChecked([])
    setCheckedMeta({})
    setOthers(null)
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
      setCheckedMeta({})
      setOthers(null)
    }
  }

  /**
   * 加载"其他认证商家"（未在售该型号，可帮找货）
   * 改动说明（v1.7.52 邀请放宽）：排除互联网来源商家（无账号、收不到站内信）、我在职商户与已有货商家
   */
  const loadOthers = (keyword: string) => {
    setOthersLoading(true)
    const myIds = new Set(useMerchantStore.getState().merchants.map((m) => m.merchantId))
    const stockIds = new Set((inviteList ?? []).map((m) => m.merchantId))
    searchMerchants({
      keyword: keyword.trim() || undefined,
      verifiedOnly: true,
      excludeInternet: true,
      sortBy: 'productcount',
      sortOrder: 'desc',
      pageSize: 20
    })
      .then((r) => {
        // 改动说明（v1.7.52）：只保留在职认证商家——已停用/草稿商户收不到站内信，服务端也会拒绝
        const list = (r.items ?? []).filter((m) => m.isVerified && m.status === 'Active' && !myIds.has(m.id) && !stockIds.has(m.id))
        setOthers(list)
      })
      .catch(() => setOthers([]))
      .finally(() => setOthersLoading(false))
  }

  /** 展开/收起"其他认证商家"，首次展开时加载 */
  const toggleOthers = () => {
    const next = !showOthers
    setShowOthers(next)
    if (next && others === null) loadOthers(othersKeyword)
  }

  /**
   * 切换邀请勾选（点行整行触发）
   * 改动说明（v1.7.52）：同时记录名称与是否有货，供已选区展示
   */
  const toggleChecked = (merchantId: string, name: string, hasStock: boolean) => {
    const isChecked = checked.includes(merchantId)
    setChecked((prev) => isChecked ? prev.filter((x) => x !== merchantId) : [...prev, merchantId])
    setCheckedMeta((prev) => {
      const next = { ...prev }
      if (isChecked) delete next[merchantId]
      else next[merchantId] = { name, hasStock }
      return next
    })
  }

  /** 有货组全选/全不选（v1.7.52：只作用于有货组，其他认证商家需逐个勾选） */
  const toggleAllStock = () => {
    if (!inviteList) return
    const stockIds = inviteList.map((m) => m.merchantId)
    const allStockChecked = stockIds.length > 0 && stockIds.every((id) => checked.includes(id))
    if (allStockChecked) {
      setChecked((prev) => prev.filter((id) => !stockIds.includes(id)))
      setCheckedMeta((prev) => {
        const next = { ...prev }
        stockIds.forEach((id) => delete next[id])
        return next
      })
      return
    }
    setChecked((prev) => Array.from(new Set([...prev, ...stockIds])))
    setCheckedMeta((prev) => {
      const next = { ...prev }
      inviteList.forEach((m) => { next[m.merchantId] = { name: m.merchantName, hasStock: true } })
      return next
    })
  }

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
    // 改动说明（v1.7.52 邀请放宽）：勾选为空不再等同"全部匹配"——必须明确勾选至少一家，
    //   避免用户以为邀到了实际没人收到；跨页预填指定的收件人不受此限
    if (mode === 'invited' && checked.length === 0 && preInvited.length === 0) {
      Taro.showToast({ title: '请至少勾选一家商家，或改为公开', icon: 'none' })
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
    // 改动说明（v1.7.52）：收件人一律显式提交勾选集合（不再折叠成空数组"全部匹配"，
    //   否则勾了"其他认证商家"也会被服务端按在售匹配口径丢掉）；从商家主页进入的指定收件人（无清单可勾选）一并并入
    const invitedMerchantIds = invited ? Array.from(new Set([...checked, ...preInvited])) : null
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
    <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', minHeight: 48, borderStyle: 'solid', borderWidth: 0, borderBottomWidth: 1, borderBottomColor: t.border }}>
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
  const modeOption = (value: 'public' | 'invited', title: string, desc: string) => {
    const active = mode === value
    const tone = active ? t.primary : t.textSecondary
    return (
      <View
        style={{
          display: 'flex', flexDirection: 'column', flex: 1, marginRight: value === 'public' ? 8 : 0,
          paddingLeft: 10, paddingRight: 10, paddingTop: 9, paddingBottom: 9, borderRadius: 10,
          borderStyle: 'solid', borderWidth: 1, borderColor: active ? t.primary : t.border,
          backgroundColor: active ? t.primaryLight : t.bgCard,
        }}
        onClick={() => setMode(value)}
      >
        <Text style={{ ...fs(13), color: tone, fontWeight: '600' }}>{title}</Text>
        <Text style={{ ...fs(10), color: t.textTertiary, marginTop: 3 }}>{desc}</Text>
      </View>
    )
  }

  /** 邀请候选行（勾选圈 + 名称 + 标记；有货组与其他认证商家共用） */
  const candidateRow = (id: string, name: string, hasStock: boolean, tag: string, tagColor: string) => {
    const isChecked = checked.includes(id)
    return (
      <View
        key={id}
        style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', minHeight: 40, borderStyle: 'solid', borderWidth: 0, borderBottomWidth: 1, borderBottomColor: t.border }}
        onClick={() => toggleChecked(id, name, hasStock)}
      >
        <View
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: 8,
            borderStyle: 'solid', borderWidth: 1, borderColor: isChecked ? t.primary : t.border,
            backgroundColor: isChecked ? t.primary : t.bgCard,
          }}
        >
          {isChecked ? <Icon name='check' size={11} color='#FFFFFF' /> : null}
        </View>
        <Text style={{ ...fs(13), color: t.textPrimary, marginLeft: 8, flex: 1 }} numberOfLines={1}>{name}</Text>
        <Text style={{ ...fs(10), color: tagColor }}>{tag}</Text>
      </View>
    )
  }

  // 按钮三态推导（v1.7.21）：额度内免费发布 → 超限花轴承币 → 余额不足去赚分
  const pq = quota?.publish
  const freeLeft = pq ? Math.max(pq.freeLimit - pq.todayUsed, 0) : null
  const overFree = !!pq && pq.todayUsed >= pq.freeLimit
  const insufficient = overFree && !!quota && quota.balance < pq.pointsPrice
  const checkedList = checked.filter((id) => checkedMeta[id])

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

          {/* 型号行（v1.7.52 型号联想）：输入即搜平台型号，选中自动关联并拉有货商家清单 */}
          <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', minHeight: 48, borderStyle: 'solid', borderWidth: 0, borderBottomWidth: 1, borderBottomColor: t.border }}>
            <Text style={{ ...fs(14), color: t.textPrimary, width: 76 }}>型号 *</Text>
            <Input
              style={{ ...fs(15), flex: 1, color: t.textPrimary }}
              placeholder='必填，如 6205-2RS / 深沟球轴承'
              placeholderTextColor={t.textTertiary}
              value={form.partNumber}
              onInput={(e) => onPartNumberInput(e.detail.value)}
            />
          </View>

          {/* 已关联态 / 未关联提示（v1.7.52）：未关联不会定向通知商家，必须让用户看见 */}
          {meta.bearingId ? (
            <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
              <Text style={{ ...fs(11), color: t.primary, flex: 1 }} numberOfLines={1}>已关联：{linkedLabel || form.partNumber}</Text>
              <Text style={{ ...fs(11), color: t.textTertiary }} onClick={unlinkBearing}>取消关联</Text>
            </View>
          ) : form.partNumber.trim() ? (
            <View style={{ display: 'flex', marginTop: 6, paddingLeft: 10, paddingRight: 10, paddingTop: 7, paddingBottom: 7, backgroundColor: t.bgInput, borderRadius: 8 }}>
              <Text style={{ ...fs(11), color: t.textSecondary }}>
                未关联平台型号：只进大厅，不会定向通知商家；可从上方候选选择平台型号，或在下方手动邀请认证商家
              </Text>
            </View>
          ) : null}

          {/* 联想候选（v1.7.52）：普通 View 内联展开，不用绝对定位浮层（小程序层级与 RN 兼容） */}
          {suggestLoading ? (
            <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 6 }}>正在搜索平台型号…</Text>
          ) : suggestions.length > 0 ? (
            <View style={{ marginTop: 6, paddingLeft: 10, paddingRight: 10, backgroundColor: t.bgInput, borderRadius: 8 }}>
              {suggestions.map((b) => (
                <View
                  key={b.id}
                  style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', minHeight: 40, borderStyle: 'solid', borderWidth: 0, borderBottomWidth: 1, borderBottomColor: t.border }}
                  onClick={() => pickSuggestion(b)}
                >
                  <Text style={{ ...fs(13), color: t.textPrimary, flex: 1 }} numberOfLines={1}>{b.partNumber}</Text>
                  <Text style={{ ...fs(11), color: t.textSecondary, marginLeft: 8 }} numberOfLines={1}>
                    {[b.brandName, b.bearingType].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

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

        {/* 发布方式（v1.8.0 公开/邀请）：公开=进大厅人人可应答；邀请=只通知勾选的认证商家 */}
        <View style={{ marginLeft: 12, marginRight: 12, paddingLeft: 14, paddingRight: 14, paddingTop: 12, paddingBottom: 12, backgroundColor: t.bgCard, borderRadius: 12 }}>
          <Text style={{ ...fs(13), color: t.textPrimary, fontWeight: '600' }}>发布方式</Text>
          <View style={{ display: 'flex', flexDirection: 'row', marginTop: 8 }}>
            {modeOption('public', '公开', '进寻货大厅，所有商家都能看到并应答')}
            {modeOption('invited', '邀请', '只通知你勾选的认证商家（含未在售该型号、可帮找货的）')}
          </View>

          {/* 邀请收件人（v1.7.52）：有货组（默认全选）+ 其他认证商家（未在售，可帮找货） */}
          {mode === 'invited' ? (
            <View style={{ marginTop: 8 }}>
              {inviteError ? (
                // 改动说明（v1.8.1）：加载失败 ≠ 无人在售——给重试入口
                <View>
                  <Text style={{ ...fs(11), color: t.textTertiary }}>
                    在售商家清单加载失败，可重试；也可直接手动选择认证商家
                  </Text>
                  <Text
                    style={{ ...fs(12), color: t.primary, marginTop: 6 }}
                    onClick={() => { if (meta.bearingId) loadInviteList(meta.bearingId, null) }}
                  >
                    点击重试
                  </Text>
                </View>
              ) : inviteList === null ? (
                <Text style={{ ...fs(11), color: t.textTertiary }}>
                  {meta.bearingId
                    ? '正在加载在售商家…'
                    : preInvited.length > 0
                      ? `已指定邀请 ${preInvited.length} 家商家（从商家主页进入），也可在下方增选其他认证商家`
                      : '未关联平台型号：请在下方手动选择认证商家'}
                </Text>
              ) : inviteList.length === 0 ? (
                <Text style={{ ...fs(11), color: t.textTertiary }}>
                  该型号暂无在售的认证商家（自己的店铺不能邀请），可在下方选择其他认证商家帮找货
                </Text>
              ) : (
                <View>
                  <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ ...fs(12), color: t.textSecondary }}>
                      有货认证商家（已选 {inviteList.filter((m) => checked.includes(m.merchantId)).length}/{inviteList.length}）
                    </Text>
                    <Text style={{ ...fs(12), color: t.primary }} onClick={toggleAllStock}>
                      {inviteList.every((m) => checked.includes(m.merchantId)) ? '全不选' : '全选'}
                    </Text>
                  </View>
                  {inviteList.map((m) => candidateRow(m.merchantId, m.merchantName, true, '有货', t.primary))}
                </View>
              )}

              {/* 其他认证商家（v1.7.52 邀请放宽）：未在售该型号也可邀，支持关键词搜索 */}
              <View style={{ marginTop: 10, borderStyle: 'solid', borderWidth: 0, borderTopWidth: 1, borderTopColor: t.border, paddingTop: 10 }}>
                <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }} onClick={toggleOthers}>
                  <Text style={{ ...fs(12), color: t.textSecondary, flex: 1 }}>
                    其他认证商家（未在售，可帮找货）
                  </Text>
                  <Text style={{ ...fs(12), color: t.primary }}>{showOthers ? '收起' : '展开选择'}</Text>
                </View>
                {showOthers ? (
                  <View style={{ marginTop: 8 }}>
                    <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', minHeight: 40, borderStyle: 'solid', borderWidth: 0, borderBottomWidth: 1, borderBottomColor: t.border }}>
                      <Input
                        style={{ ...fs(13), flex: 1, color: t.textPrimary }}
                        placeholder='搜索商家名称'
                        placeholderTextColor={t.textTertiary}
                        value={othersKeyword}
                        onInput={(e) => setOthersKeyword(e.detail.value)}
                        onBlur={() => loadOthers(othersKeyword)}
                      />
                      <Text style={{ ...fs(12), color: t.primary }} onClick={() => loadOthers(othersKeyword)}>搜索</Text>
                    </View>
                    {othersLoading ? (
                      <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 6 }}>正在加载商家…</Text>
                    ) : others && others.length > 0 ? (
                      others.map((m) => candidateRow(m.id, m.name, false, '找货', t.textSecondary))
                    ) : (
                      <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 6 }}>
                        {others === null ? '' : '没有更多可邀请的认证商家'}
                      </Text>
                    )}
                  </View>
                ) : null}
              </View>

              {/* 已选区（v1.7.52）：两组候选合并勾选后的最终收件人，逐个可移除 */}
              {checkedList.length > 0 ? (
                <View style={{ marginTop: 10, paddingLeft: 10, paddingRight: 10, paddingTop: 8, paddingBottom: 8, backgroundColor: t.primaryLight, borderRadius: 8 }}>
                  <Text style={{ ...fs(11), color: t.primary }}>已选 {checkedList.length} 家</Text>
                  {checkedList.map((id) => (
                    <View key={id} style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                      <Text style={{ ...fs(12), color: t.textPrimary, flex: 1 }} numberOfLines={1}>
                        {checkedMeta[id].name}（{checkedMeta[id].hasStock ? '有货' : '找货'}）
                      </Text>
                      <Text style={{ ...fs(11), color: t.textTertiary }} onClick={() => toggleChecked(id, checkedMeta[id].name, checkedMeta[id].hasStock)}>移除</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        <Text style={{ ...fs(12), color: t.textTertiary, marginLeft: 16, marginRight: 16, marginTop: 8 }}>
          选择公开会进入寻货大厅（人人可应答），并通知有货的认证商家；邀请只通知你勾选的认证商家，未在售该型号的商家也可受邀帮你找货。发布后可从应答中选定一家，双方互见联系方式；寻货 14 天有效，请留意站内信通知。
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
