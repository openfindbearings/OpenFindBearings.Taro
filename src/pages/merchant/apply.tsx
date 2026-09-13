// 商家入驻向导页：合并原 apply / nominate / nominations 三页为单页向导
// 进入先查待接受提名：有邀请则直接展示"被邀请的细节"并可补资料接受；无邀请进入三步向导
//   第一步 查找方式：输入关键词联想库中商家全称（发票式）供选择，或没找到新建
//   第二步 操作方式：自己直接操作（认领已有 / 新建自营）或邀请别人操作（提名他人为管理员）
//   第三步 提交：按路径渲染对应表单，提交后刷新入驻状态
// 后端接口全部复用（claimable/apply/nominate/accept/pending），零后端改动。
// 改动说明：商家类型统一对齐后端 MerchantType 枚举 1-4（修正原 nominate 页 0-3 的偏移 bug）；
//          NavBar 返回按向导相位逐级退（form 到 mode 到 search 再退出页面），修复点返回直接退出页面的问题。
import { useRef, useState } from 'react'
import { View, Text, Input } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import Icon from '../../components/Icon'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import { useAuthStore } from '../../stores/auth'
import { useMerchantStore } from '../../stores/merchant'
import {
  applyMerchant,
  searchClaimableMerchants,
  nominateMerchant,
  getPendingNominations,
  acceptNomination,
  type ClaimableMerchant,
  type PendingNomination
} from '../../services/merchant'

/** 商家类型（对齐后端 MerchantType：1生产厂家 / 2授权经销商 / 3分销商 / 4贸易商） */
const MERCHANT_TYPES = [
  { value: 1, label: '生产厂家' },
  { value: 2, label: '授权经销商' },
  { value: 3, label: '分销商' },
  { value: 4, label: '贸易商' }
]

/** 向导三步标题（步骤条展示，与 search/mode/form 相位一一对应） */
const STEP_LABELS = ['查找方式', '操作方式', '提交']

/** 商家入驻向导页：承载提名接受、查找、操作方式选择与三类入驻提交 */
export default function MerchantApplyPage() {
  const t = useTheme()
  const fs = useFs()
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const fetchApplications = useMerchantStore((s) => s.fetchApplications)

  // 向导相位：invite 待接受提名 / search 查找 / mode 操作方式 / form 提交表单
  const [phase, setPhase] = useState<'invite' | 'search' | 'mode' | 'form'>('search')
  // 入驻动作流：claim 认领已有 / self 新建自营 / nominate 提名他人
  const [flow, setFlow] = useState<'claim' | 'self' | 'nominate'>('self')
  // 已选中的可认领商家（null 表示新建路径）
  const [selected, setSelected] = useState<ClaimableMerchant | null>(null)

  // 待接受提名列表与其展开态、补资料表单
  const [invites, setInvites] = useState<PendingNomination[]>([])
  const [openCode, setOpenCode] = useState<string | null>(null)
  const [acceptForm, setAcceptForm] = useState({
    companyName: '', creditCode: '', contactPerson: '', mobile: '', address: ''
  })
  const [accepting, setAccepting] = useState(false)

  // 查找步：关键词、结果、搜索中状态与输入防抖句柄
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<ClaimableMerchant[]>([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 新建自营表单
  const [form, setForm] = useState({
    name: '', companyName: '', type: 0, contactPerson: '',
    phone: '', address: '', unifiedSocialCreditCode: '', description: ''
  })
  // 提名表单：被提名人手机号 + 发起人代填的商户信息
  const [nomineePhone, setNomineePhone] = useState('')
  const [nomName, setNomName] = useState('')
  const [nomType, setNomType] = useState(0)
  const [nomCompanyName, setNomCompanyName] = useState('')
  const [nomAddress, setNomAddress] = useState('')
  const [initiatorJoins, setInitiatorJoins] = useState(true)

  const [submitting, setSubmitting] = useState(false)

  /** 更新自营表单字段 */
  const setField = (k: keyof typeof form, v: string | number) => setForm((prev) => ({ ...prev, [k]: v }))

  /** 拉取待我接受的提名：有邀请直接进邀请相位，无邀请从邀请相位回到查找 */
  const loadInvites = () => {
    getPendingNominations()
      .then((r) => {
        const list = r ?? []
        setInvites(list)
        if (list.length > 0) setPhase('invite')
        else if (phase === 'invite') setPhase('search')
      })
      .catch(() => { /* 未登录或网络异常时忽略提名拉取 */ })
  }

  useDidShow(() => {
    loadInvites()
    if (isLoggedIn) fetchApplications().catch(() => { /* 状态拉取失败不阻塞 */ })
  })

  /** 关键词输入防抖 400ms 后触发联想 */
  const onSearchInput = (v: string) => {
    setKeyword(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { void doSearch(v) }, 400)
  }

  /** 联想搜索可认领商家（关键词为空时清空结果） */
  const doSearch = async (kw: string) => {
    const key = kw.trim()
    if (!key) { setResults([]); return }
    setSearching(true)
    try {
      const r = await searchClaimableMerchants({ keyword: key, pageSize: 20 })
      setResults(r?.items ?? [])
    } catch { setResults([]) } finally { setSearching(false) }
  }

  /** 选中一个已有商家，进入认领路径 */
  const onPick = (m: ClaimableMerchant) => {
    setSelected(m)
    setFlow('claim')
    setPhase('mode')
  }

  /** 没找到时新建商户，进入自营/提名路径 */
  const onCreateNew = () => {
    setSelected(null)
    setFlow('self')
    setPhase('mode')
  }

  /** 新建路径下选择自营或提名他人，进入提交表单 */
  const onChooseFlow = (f: 'self' | 'nominate') => {
    setFlow(f)
    setPhase('form')
  }

  /** 认领路径直接进入确认提交 */
  const onClaimGo = () => {
    setFlow('claim')
    setPhase('form')
  }

  /** 展开或收起一条提名的补资料表单 */
  const onOpenInvite = (item: PendingNomination) => {
    setOpenCode(item.invitationCode === openCode ? null : item.invitationCode)
    setAcceptForm({ companyName: '', creditCode: '', contactPerson: '', mobile: '', address: '' })
  }

  /** 接受提名：补资料提交后提示成功并刷新提名与入驻状态 */
  const onAccept = async (code: string) => {
    if (accepting) return
    setAccepting(true)
    try {
      await acceptNomination(code, {
        companyName: acceptForm.companyName.trim() || undefined,
        unifiedSocialCreditCode: acceptForm.creditCode.trim() || undefined,
        contactPerson: acceptForm.contactPerson.trim() || undefined,
        mobile: acceptForm.mobile.trim() || undefined,
        address: acceptForm.address.trim() || undefined
      })
      Taro.showModal({
        title: '提交成功',
        content: '资料已提交，等待平台审核通过后即可开始经营。',
        showCancel: false
      }).then(() => { loadInvites(); void fetchApplications() }).catch(() => loadInvites())
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '接受提名失败', icon: 'none' })
    } finally { setAccepting(false) }
  }

  /** 弹出商家类型选择动作面板 */
  const pickType = (current: number, setter: (v: number) => void) => {
    Taro.showActionSheet({ itemList: MERCHANT_TYPES.map((x) => x.label) })
      .then((res) => {
        const item = MERCHANT_TYPES[res.tapIndex]
        if (item) setter(item.value)
      })
      .catch(() => { /* 用户取消选择 */ })
  }

  /** 统一提交入口：按 flow 分发到认领 / 自营 / 提名三类请求 */
  const onSubmit = async () => {
    if (submitting) return
    if (!isLoggedIn) {
      Taro.showToast({ title: '请先登录后再申请入驻', icon: 'none' })
      return
    }

    if (flow === 'claim') {
      if (!selected) {
        Taro.showToast({ title: '请先选择要认领的商家', icon: 'none' })
        return
      }
      setSubmitting(true)
      try {
        const r = await applyMerchant({ mode: 'claim', claimMerchantId: selected.id })
        Taro.showToast({ title: r?.message || '认领申请已提交，等待审核', icon: 'success' })
        void fetchApplications()
        setTimeout(() => Taro.navigateBack(), 800)
      } catch (e: any) {
        Taro.showToast({ title: e?.message || '认领提交失败', icon: 'none' })
      } finally { setSubmitting(false) }
      return
    }

    if (flow === 'self') {
      if (!form.name.trim()) {
        Taro.showToast({ title: '请填写商家名称', icon: 'none' })
        return
      }
      setSubmitting(true)
      try {
        const r = await applyMerchant({
          mode: 'self',
          name: form.name.trim(),
          type: form.type || undefined,
          contactPerson: form.contactPerson.trim() || undefined,
          phone: form.phone.trim() || undefined,
          address: form.address.trim() || undefined,
          companyName: form.companyName.trim() || undefined,
          unifiedSocialCreditCode: form.unifiedSocialCreditCode.trim() || undefined,
          description: form.description.trim() || undefined
        })
        Taro.showToast({ title: r?.message || '入驻申请已提交，等待审核', icon: 'success' })
        void fetchApplications()
        setTimeout(() => Taro.navigateBack(), 800)
      } catch (e: any) {
        Taro.showToast({ title: e?.message || '入驻申请提交失败', icon: 'none' })
      } finally { setSubmitting(false) }
      return
    }

    // flow === 'nominate'
    if (!/^1\d{10}$/.test(nomineePhone)) {
      Taro.showToast({ title: '请填写被提名人正确的手机号', icon: 'none' })
      return
    }
    if (!nomName.trim()) {
      Taro.showToast({ title: '请填写商家名称', icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      await nominateMerchant({
        nomineePhone,
        name: nomName.trim(),
        type: nomType || undefined,
        companyName: nomCompanyName.trim() || undefined,
        address: nomAddress.trim() || undefined,
        initiatorJoins
      })
      Taro.showModal({
        title: '提名已发出',
        content: '被提名人接受提名并补全资料后即可提交审核，你也可以稍后在商户页查看进度。',
        showCancel: false
      }).then(() => Taro.navigateBack()).catch(() => Taro.navigateBack())
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '提名发送失败，请检查对方手机号是否已注册', icon: 'none' })
    } finally { setSubmitting(false) }
  }

  /** 左标题右控件的单行字段行（自营表单用） */
  const fieldRow = (label: string, node: any) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.bgCard, paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: t.border }}>
      <Text style={{ ...fs(15), color: t.textPrimary, width: 92 }}>{label}</Text>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>{node}</View>
    </View>
  )
  const inputStyle = { ...fs(15), color: t.textPrimary, textAlign: 'right' as const, flex: 1 }

  /** 上标签下输入框的列式字段（提名/接受表单用） */
  const fieldColumn = (label: string, value: string, onChange: (v: string) => void, placeholder?: string, type?: 'text' | 'number') => (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ ...fs(13), color: t.textSecondary, marginBottom: 4 }}>{label}</Text>
      <Input
        style={{ backgroundColor: t.bgInput, borderRadius: 8, paddingLeft: 10, paddingRight: 10, paddingTop: 10, paddingBottom: 10, fontSize: 15, lineHeight: 22, color: t.textPrimary }}
        value={value}
        type={type || 'text'}
        placeholder={placeholder}
        placeholderStyle={`color:${t.textTertiary}`}
        onInput={(e) => onChange(e.detail.value)}
      />
    </View>
  )

  /** 操作方式选择卡片（图标 + 标题 + 描述 + 右箭头） */
  const optionCard = (icon: string, title: string, desc: string, onClick: () => void) => (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.bgCard, borderRadius: 12, borderWidth: 1, borderColor: t.border, padding: 14, marginBottom: 12 }}
      onClick={onClick}
    >
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={20} color={t.primary} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ ...fs(15), color: t.textPrimary }}>{title}</Text>
        <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 2 }}>{desc}</Text>
      </View>
      <Icon name="chevron-right" size={16} color={t.textTertiary} />
    </View>
  )

  /** 统一提交按钮（提交中禁用变灰） */
  const submitButton = (label: string) => (
    <View
      style={{ backgroundColor: submitting ? t.textTertiary : t.primary, borderRadius: 24, paddingTop: 12, paddingBottom: 12, alignItems: 'center', marginTop: 18 }}
      onClick={submitting ? undefined : onSubmit}
    >
      <Text style={{ ...fs(16), color: t.textOnPrimary }}>{submitting ? '提交中…' : label}</Text>
    </View>
  )

  /** 步骤条：当前相位高亮，序号圆点 + 文字（修复点：文字 lineHeight 给足避免顶部裁切） */
  const stepIndex = phase === 'mode' ? 1 : phase === 'form' ? 2 : 0
  const stepBar = (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
      {STEP_LABELS.map((label, i) => {
        const active = i <= stepIndex
        return (
          <View key={label} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: active ? t.primary : t.border, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 11, lineHeight: 22, color: active ? t.textOnPrimary : t.textTertiary }}>{i + 1}</Text>
            </View>
            <Text style={{ fontSize: 12, lineHeight: 18, color: i === stepIndex ? t.textPrimary : t.textTertiary, marginLeft: 4 }}>{label}</Text>
            {i < STEP_LABELS.length - 1 && (
              <View style={{ flex: 1, height: 2, backgroundColor: i < stepIndex ? t.primary : t.border, marginLeft: 6, marginRight: 6 }} />
            )}
          </View>
        )
      })}
    </View>
  )

  /** 邀请相位：待接受提名列表 + 展开补资料（合并原 nominations 页） */
  const renderInvite = () => (
    <View>
      <Text style={{ ...fs(13), color: t.textTertiary, marginBottom: 12 }}>
        你收到了其他用户发来的商户管理员提名，补全资料并成功后即可提交审核。
      </Text>
      {invites.length === 0 ? (
        <View style={{ alignItems: 'center', paddingTop: 40 }}>
          <Icon name="mail" size={40} color={t.textTertiary} />
          <Text style={{ ...fs(14), color: t.textTertiary, marginTop: 12 }}>暂无待接受的提名</Text>
        </View>
      ) : (
        invites.map((item) => {
          const open = item.invitationCode === openCode
          return (
            <View key={item.invitationCode} style={{ backgroundColor: t.bgCard, borderRadius: 12, padding: 14, marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }} onClick={() => onOpenInvite(item)}>
                <View style={{ flex: 1 }}>
                  <Text style={{ ...fs(15), color: t.textPrimary }}>{item.merchantName}</Text>
                  <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 4 }}>
                    {item.companyName ? `公司：${item.companyName}` : '邀请你成为该商户管理员'}
                  </Text>
                </View>
                <Text style={{ ...fs(13), color: t.primary }}>{open ? '收起' : '接受提名并补资料'}</Text>
              </View>
              {open && (
                <View style={{ marginTop: 14 }}>
                  {fieldColumn('企业名称', acceptForm.companyName, (v) => setAcceptForm((p) => ({ ...p, companyName: v })), '营业执照上的企业名称')}
                  {fieldColumn('统一社会信用代码', acceptForm.creditCode, (v) => setAcceptForm((p) => ({ ...p, creditCode: v })), '18位信用代码（选填）')}
                  {fieldColumn('联系人', acceptForm.contactPerson, (v) => setAcceptForm((p) => ({ ...p, contactPerson: v })), '您的姓名')}
                  {fieldColumn('手机号', acceptForm.mobile, (v) => setAcceptForm((p) => ({ ...p, mobile: v })), '11位手机号', 'number')}
                  {fieldColumn('地址', acceptForm.address, (v) => setAcceptForm((p) => ({ ...p, address: v })), '经营地址（选填）')}
                  <View
                    style={{ backgroundColor: accepting ? t.textTertiary : t.primary, borderRadius: 24, paddingTop: 11, paddingBottom: 11, alignItems: 'center', marginTop: 4 }}
                    onClick={accepting ? undefined : () => onAccept(item.invitationCode)}
                  >
                    <Text style={{ ...fs(15), color: t.textOnPrimary }}>{accepting ? '提交中…' : '接受提名并提交审核'}</Text>
                  </View>
                </View>
              )}
            </View>
          )
        })
      )}
      <View
        style={{ backgroundColor: t.bgCard, borderRadius: 24, paddingTop: 12, paddingBottom: 12, alignItems: 'center', borderWidth: 1, borderColor: t.primary }}
        onClick={() => setPhase('search')}
      >
        <Text style={{ ...fs(15), color: t.primary }}>不是我的商户？我自己申请入驻</Text>
      </View>
    </View>
  )

  /** 第一步 查找方式：关键词联想库中商家全称，或新建 */
  const renderSearch = () => (
    <View>
      <Text style={{ ...fs(13), color: t.textSecondary, marginBottom: 10 }}>
        输入商家名称关键字，查询商家全称
      </Text>
      {/* 描边胶囊 + 放大镜：让搜索框在浅灰卡片背景上足够醒目（修复：原无边框浅灰底不明显） */}
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.bgInput, borderRadius: 10, borderWidth: 1, borderColor: t.border, paddingLeft: 12, paddingRight: 12 }}>
        <Icon name="search" size={18} color={t.textTertiary} />
        <Input
          style={{ flex: 1, ...fs(15), color: t.textPrimary, marginLeft: 8, paddingTop: 11, paddingBottom: 11, minHeight: 42, lineHeight: 22 }}
          value={keyword}
          placeholder="输入关键字，如：人本 / 光洋 / 轴承"
          placeholderClass="auth-ph"
          onInput={(e) => onSearchInput(e.detail.value)}
          confirmType="search"
          onConfirm={() => { void doSearch(keyword) }}
        />
      </View>
      <View style={{ marginTop: 12 }}>
        {searching && <Text style={{ ...fs(13), color: t.textTertiary }}>搜索中…</Text>}
        {!searching && keyword.trim() && results.length === 0 && (
          <View style={{ alignItems: 'center', paddingTop: 20, paddingBottom: 8 }}>
            <Text style={{ ...fs(13), color: t.textTertiary }}>未找到相关商家，可在下方新建</Text>
          </View>
        )}
        {results.map((item) => (
          <View
            key={item.id}
            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.bgCard, borderRadius: 12, padding: 12, marginBottom: 8 }}
            onClick={() => onPick(item)}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ ...fs(15), color: t.textPrimary }}>{item.name}</Text>
              {item.companyName ? <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 2 }}>{item.companyName}</Text> : null}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ ...fs(12), color: t.textTertiary, marginRight: 6 }}>{item.type}</Text>
              <Icon name="chevron-right" size={16} color={t.textTertiary} />
            </View>
          </View>
        ))}
      </View>
      {/* 新建入口：改为带"+"的描边按钮，去掉原 borderTopWidth 横线（修复：横线易被误认为输入位置） */}
      <View style={{ marginTop: 18 }}>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: t.bgCard, borderRadius: 24, paddingTop: 12, paddingBottom: 12, borderWidth: 1, borderColor: t.primary }}
          onClick={onCreateNew}
        >
          <Text style={{ ...fs(16), color: t.primary, marginRight: 6 }}>+</Text>
          <Text style={{ ...fs(15), color: t.primary }}>没找到？新建商户</Text>
        </View>
      </View>
    </View>
  )

  /** 第二步 操作方式：已选商家走认领；新建走自营或提名他人 */
  const renderMode = () => {
    if (selected) {
      return (
        <View>
          <Text style={{ ...fs(13), color: t.textSecondary, marginBottom: 10 }}>已选择以下商家，请确认认领：</Text>
          <View style={{ backgroundColor: t.bgCard, borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <Text style={{ ...fs(16), color: t.textPrimary }}>{selected.name}</Text>
            {selected.companyName ? <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 4 }}>{selected.companyName}</Text> : null}
            <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 4 }}>类型：{selected.type}</Text>
          </View>
          {optionCard('store', '自己认领经营', '确认认领该商家，由你作为管理员维护商品', onClaimGo)}
          <Text style={{ ...fs(12), color: t.textTertiary }}>
            认领后需平台审核通过，审核通过后即可上架商品。
          </Text>
        </View>
      )
    }
    return (
      <View>
        <Text style={{ ...fs(13), color: t.textSecondary, marginBottom: 12 }}>请选择本次入驻的操作方式：</Text>
        {optionCard('store', '自己直接操作', '新建商户并由你担任管理员，提交资料后等待审核', () => onChooseFlow('self'))}
        {optionCard('user-plus', '邀请别人操作', '新建商户并提名他人为管理员，对方接受后补资料', () => onChooseFlow('nominate'))}
      </View>
    )
  }

  /** 第三步 提交：按 flow 渲染认领确认 / 自营表单 / 提名表单 */
  const renderForm = () => {
    let body: any = null
    let buttonLabel = '提交'
    if (flow === 'claim' && selected) {
      body = (
        <View>
          <View style={{ backgroundColor: t.bgCard, borderRadius: 12, padding: 14 }}>
            <Text style={{ ...fs(16), color: t.textPrimary }}>{selected.name}</Text>
            {selected.companyName ? <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 4 }}>{selected.companyName}</Text> : null}
            <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 4 }}>类型：{selected.type}</Text>
          </View>
          <Text style={{ ...fs(12), color: t.textTertiary, textAlign: 'center', marginTop: 10 }}>
            确认认领后，平台将核实资料并开通商户权限，审核通过后即可维护商品。
          </Text>
        </View>
      )
      buttonLabel = '提交认领申请'
    } else if (flow === 'self') {
      body = (
        <View style={{ borderRadius: 12, overflow: 'hidden' }}>
          {fieldRow('商家名称', <Input style={inputStyle} value={form.name} maxlength={50} placeholder="必填，对外展示名称" placeholderClass="auth-ph" onInput={(e) => setField('name', e.detail.value)} />)}
          {fieldRow('商家类型', (
            <View style={{ flexDirection: 'row', alignItems: 'center' }} onClick={() => pickType(form.type, (v) => setField('type', v))}>
              <Text style={{ ...fs(15), color: form.type ? t.textPrimary : t.textTertiary }}>
                {MERCHANT_TYPES.find((x) => x.value === form.type)?.label || '请选择'}
              </Text>
              <Icon name="chevron-right" size={16} color={t.textTertiary} />
            </View>
          ))}
          {fieldRow('企业名称', <Input style={inputStyle} value={form.companyName} maxlength={100} placeholder="营业执照企业名称（选填）" placeholderClass="auth-ph" onInput={(e) => setField('companyName', e.detail.value)} />)}
          {fieldRow('信用代码', <Input style={inputStyle} value={form.unifiedSocialCreditCode} maxlength={30} placeholder="18位统一社会信用代码（选填）" placeholderClass="auth-ph" onInput={(e) => setField('unifiedSocialCreditCode', e.detail.value)} />)}
          {fieldRow('联系人', <Input style={inputStyle} value={form.contactPerson} maxlength={30} placeholder="负责人姓名" placeholderClass="auth-ph" onInput={(e) => setField('contactPerson', e.detail.value)} />)}
          {fieldRow('联系电话', <Input style={inputStyle} value={form.phone} maxlength={20} placeholder="手机或座机" placeholderClass="auth-ph" onInput={(e) => setField('phone', e.detail.value)} />)}
          {fieldRow('地址', <Input style={inputStyle} value={form.address} maxlength={100} placeholder="经营地址（选填）" placeholderClass="auth-ph" onInput={(e) => setField('address', e.detail.value)} />)}
          {fieldRow('简介', <Input style={inputStyle} value={form.description} maxlength={200} placeholder="一句话介绍（选填）" placeholderClass="auth-ph" onInput={(e) => setField('description', e.detail.value)} />)}
        </View>
      )
    } else {
      body = (
        <View>
          <Text style={{ ...fs(13), color: t.textTertiary, marginBottom: 12 }}>
            填写被提名人的手机号并补充商户信息，对方接受提名后即可作为管理员维护商品。
          </Text>
          {fieldColumn('被提名人手机号 *', nomineePhone, setNomineePhone, '对方需已注册的手机号', 'number')}
          {fieldColumn('商家名称 *', nomName, setNomName, '对外展示名称')}
          <View style={{ marginBottom: 12 }}>
            <Text style={{ ...fs(13), color: t.textSecondary, marginBottom: 4 }}>商家类型</Text>
            <View style={{ backgroundColor: t.bgInput, borderRadius: 8, padding: 10, flexDirection: 'row', justifyContent: 'space-between' }} onClick={() => pickType(nomType, setNomType)}>
              <Text style={{ fontSize: 15, lineHeight: 22, color: t.textPrimary }}>{MERCHANT_TYPES.find((x) => x.value === nomType)?.label || '请选择'}</Text>
              <Text style={{ color: t.textTertiary }}>选择 ›</Text>
            </View>
          </View>
          {fieldColumn('企业名称', nomCompanyName, setNomCompanyName, '营业执照企业名称（选填）')}
          {fieldColumn('地址', nomAddress, setNomAddress, '经营地址（选填）')}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }} onClick={() => setInitiatorJoins(!initiatorJoins)}>
            <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: initiatorJoins ? t.primary : t.border, backgroundColor: initiatorJoins ? t.primary : 'transparent', marginRight: 8 }} />
            <Text style={{ ...fs(14), color: t.textPrimary }}>我同时以员工身份加入该商户</Text>
          </View>
        </View>
      )
      buttonLabel = '发出提名邀请'
    }

    return (
      <View>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}
          onClick={() => setPhase('mode')}
        >
          <Icon name="chevron-left" size={16} color={t.textSecondary} />
          <Text style={{ ...fs(13), color: t.textSecondary }}>返回上一步</Text>
        </View>
        {body}
        {submitButton(buttonLabel)}
      </View>
    )
  }

  /** 向导返回：按相位逐级退（form 到 mode 到 search 再退出页面），拦截 NavBar 默认直接退出 */
  const onWizardBack = () => {
    if (phase === 'form') {
      setPhase('mode')
    } else if (phase === 'mode') {
      setPhase('search')
    } else {
      Taro.navigateBack()
    }
  }

  return (
    <PageLayout nav={<NavBar title="商家入驻" showBack onBack={onWizardBack} />}>
      <View style={{ padding: 16 }}>
        {phase === 'invite' ? renderInvite() : (
          <View>
            {stepBar}
            {phase === 'search' && renderSearch()}
            {phase === 'mode' && renderMode()}
            {phase === 'form' && renderForm()}
          </View>
        )}
      </View>
    </PageLayout>
  )
}
