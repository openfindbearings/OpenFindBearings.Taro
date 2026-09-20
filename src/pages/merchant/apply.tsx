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
import Taro, { useRouter, useDidShow } from '@tarojs/taro'
import Icon from '../../components/Icon'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import { showConfirmDialog } from '../../components/ConfirmDialog'
import { useAuthStore } from '../../stores/auth'
import { useMerchantStore } from '../../stores/merchant'
import { useHardwareBack } from '../../hooks/useHardwareBack'
import {
  applyMerchant,
  searchClaimableMerchants,
  nominateMerchant,
  getPendingNominations,
  acceptNomination,
  getMerchantDetail,
  getApplicationDetail,
  resubmitApplication,
  uploadDocumentFile,
  type ClaimableMerchant,
  type PendingNomination,
  type DocumentInput
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
  const user = useAuthStore((s) => s.user)
  const fetchApplications = useMerchantStore((s) => s.fetchApplications)

  // 改动说明（v2.6.0）：路由参数带 merchantId 进入本页 = "被拒后修改重提"编辑模式——
  //   拉申请详情预填、跳过向导步骤、提交走 resubmit；无参数即原三步向导/邀请接受。
  const router = useRouter()
  const editMerchantId = (router.params && router.params.merchantId) || ''
  const [editing, setEditing] = useState(false)
  // 编辑模式详情只加载一次（useDidShow 每次回页都会触发）
  const editLoadedRef = useRef(false)

  // 改动说明：仅"对外联系人姓名"默认取登录昵称（申请人多半就是首任联系人，仍可改；
  //   userName 可能是账号名/手机号，不适合当联系人姓名故不取）。
  //   "客服电话"预填登录账号手机号（可改）——借鉴主流平台入驻表单默认填申请人手机，
  //   申请人多数即对外联系窗口；商户如需 400/座机可自行覆盖，不再强制留空。
  const selfContactPerson = user?.nickname || ''
  const selfPhone = user?.phoneNumber || ''

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
  // 改动说明：移除 initiatorJoins 勾选态——邀请他人为管理员时发起人本就不当管理员，
  //   固定以员工身份入伙（后端 InitiatorJoins 默认 true），无需再让用户勾选

  const [submitting, setSubmitting] = useState(false)
  // 改动说明：认领走可编辑预填表单，进入时需拉取商家详情预填，claimLoading 表示预填拉取中
  const [claimLoading, setClaimLoading] = useState(false)

  // 改动说明（v1.7.0）：入驻随单证照材料（对齐后端 DocumentRequirements 矩阵）——
  //   license 全类型必备；authorization 授权经销商必备；factory 生产厂家选传。
  //   existing 标记编辑模式回显的"已批准"材料（不重复提交），rejected 标记被驳回待补传
  const [docSlots, setDocSlots] = useState<{ license?: string; authorization?: string; factory?: string }>({})
  const [docExisting, setDocExisting] = useState<{ license?: boolean; authorization?: boolean; factory?: boolean }>({})
  const [docRejected, setDocRejected] = useState<{ license?: boolean; authorization?: boolean; factory?: boolean }>({})

  /** 清空材料槽位（切换入驻路径/邀请展开时调用，防跨表单串料） */
  const resetDocs = () => { setDocSlots({}); setDocExisting({}); setDocRejected({}) }

  /** 上传指定槽位材料：预上传只拿 URL，审核记录随申请单统一创建 */
  const pickDoc = (slot: 'license' | 'authorization' | 'factory', _type: number) => {
    uploadDocumentFile()
      .then((r) => {
        if (r.url) {
          setDocSlots((p) => ({ ...p, [slot]: r.url }))
          setDocExisting((p) => ({ ...p, [slot]: false }))
          setDocRejected((p) => ({ ...p, [slot]: false }))
        } else {
          Taro.showToast({ title: r.message || '上传失败', icon: 'none' })
        }
      })
      .catch(() => Taro.showToast({ title: '上传失败', icon: 'none' }))
  }

  /** 材料矩阵校验（与后端 DocumentRequirements 同口径）：返回 null 通过，否则提示语 */
  const docsError = (type: number): string | null => {
    if (!type) return '请选择商家类型'
    if (!docSlots.license) return '请上传营业执照'
    if (type === 2 && !docSlots.authorization) return '授权经销商必须上传品牌授权书'
    return null
  }

  /** 组装本次随单提交的文档项（已批准回显材料不重复提交，后端按存量 Approved 合并判定） */
  const buildDocs = (): DocumentInput[] | undefined => {
    const arr: DocumentInput[] = []
    if (docSlots.license && !docExisting.license) arr.push({ type: 1, fileUrl: docSlots.license })
    if (docSlots.authorization && !docExisting.authorization) arr.push({ type: 2, fileUrl: docSlots.authorization })
    if (docSlots.factory && !docExisting.factory) arr.push({ type: 3, fileUrl: docSlots.factory })
    return arr.length ? arr : undefined
  }

  /** 材料上传行：槽位标题+必传星号，点击选图上传，显示当前状态（已批准/已上传/被驳回） */
  const docRow = (label: string, required: boolean, slot: 'license' | 'authorization' | 'factory', type: number, tip?: string) => (
    fieldRow(`${label}${required ? ' *' : ''}`,
      <View style={{ flex: 1 }} onClick={() => pickDoc(slot, type)}>
        <Text style={{ ...fs(14), color: docExisting[slot] ? t.primary : docSlots[slot] ? t.textSecondary : t.primary }}>
          {docExisting[slot] ? '已批准，无需重传'
            : docRejected[slot] ? '被驳回，点击重新上传'
            : docSlots[slot] ? '已上传，点击重新选择'
            : '点击上传（JPG/PNG）'}
        </Text>
        {!!tip && <Text style={{ ...fs(11), color: t.textTertiary }}>{tip}</Text>}
      </View>)
  )
  // 自营/认领共用同一份可编辑表单（认领时预填现有资料供逐项核对）
  const blankForm = {
    name: '', companyName: '', type: 0, contactPerson: '',
    phone: '', address: '', unifiedSocialCreditCode: '', description: ''
  }

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
    // 编辑模式：首次显示拉申请详情预填，不查提名不刷入驻状态（退出时由商户页自刷）
    if (editMerchantId) {
      if (!editLoadedRef.current) void loadApplicationToForm()
      return
    }
    loadInvites()
    if (isLoggedIn) fetchApplications().catch(() => { /* 状态拉取失败不阻塞 */ })
  })

  /** 编辑模式预填：拉被拒申请详情，校验渠道/状态后灌入表单并直达表单相位 */
  const loadApplicationToForm = async () => {
    editLoadedRef.current = true
    setClaimLoading(true)
    try {
      const d = await getApplicationDetail(editMerchantId)
      if (!d) {
        Taro.showToast({ title: '申请不存在或你已不是该商户成员', icon: 'none' })
        setTimeout(() => Taro.navigateBack(), 900)
        return
      }
      if (d.status !== 'Suspended') {
        Taro.showToast({ title: '仅被驳回的申请可以修改重提', icon: 'none' })
        setTimeout(() => Taro.navigateBack(), 900)
        return
      }
      if (d.applicationMode !== 'self' && d.applicationMode !== 'claim') {
        Taro.showToast({ title: '该申请暂不支持自助修改重提', icon: 'none' })
        setTimeout(() => Taro.navigateBack(), 900)
        return
      }
      setEditing(true)
      // 上方守卫已排除 nomination/none，此处仅剩 self|claim 两值，显式断言（babel 构建不做类型窄化检查）
      setFlow(d.applicationMode as 'self' | 'claim')
      // 认领单需要 selected 非空才会渲染可编辑表单（复用向导同款表单），回填自身商户信息即可
      if (d.applicationMode === 'claim') {
        setSelected({ id: d.merchantId, name: d.merchantName, companyName: d.companyName ?? null })
      }
      setForm({
        name: d.merchantName || '',
        companyName: d.companyName || '',
        type: d.type || 0,
        contactPerson: d.contactPerson || '',
        phone: d.phone || '',
        address: d.address || '',
        unifiedSocialCreditCode: d.unifiedSocialCreditCode || '',
        description: d.description || ''
      })
      // 改动说明（v1.7.0）：材料回显——已批准槽位沿用（重提不重复传），被驳回槽位标记补传
      const docs = d.documents ?? []
      const approvedOf = (tp: number) => docs.find((x) => x.type === tp && x.status === 'Approved')
      const rejectedOf = (tp: number) => docs.some((x) => x.type === tp && x.status === 'Rejected')
      setDocSlots({ license: approvedOf(1)?.fileUrl, authorization: approvedOf(2)?.fileUrl, factory: approvedOf(3)?.fileUrl })
      setDocExisting({ license: !!approvedOf(1), authorization: !!approvedOf(2), factory: !!approvedOf(3) })
      setDocRejected({ license: rejectedOf(1), authorization: rejectedOf(2), factory: rejectedOf(3) })
      setPhase('form')
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '申请详情加载失败', icon: 'none' })
      setTimeout(() => Taro.navigateBack(), 900)
    } finally { setClaimLoading(false) }
  }

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

  /** 选中一个已有商家，进入操作方式选择（自我认领 / 邀请他人认领） */
  const onPick = (m: ClaimableMerchant) => {
    setSelected(m)
    setPhase('mode')
  }

  /** 没找到时新建商户，进入操作方式选择（自我新建 / 邀请他人） */
  const onCreateNew = () => {
    setSelected(null)
    setPhase('mode')
  }

  /** 我当管理员 + 新建：预填对外联系人与客服电话（登录账号手机，均可改）进入自营 */
  const onSelfGo = () => {
    setForm({ ...blankForm, contactPerson: selfContactPerson, phone: selfPhone })
    resetDocs()
    setFlow('self')
    setPhase('form')
  }

  /** 邀请别人当管理员：进入提名表单（selected 非空=提名认领已有，为空=提名新建） */
  const onNominateGo = () => {
    setFlow('nominate')
    setPhase('form')
  }

  /** 我当管理员 + 认领已有：进入可编辑预填表单，并拉取商家详情供逐项核对 */
  const onClaimGo = () => {
    // 改动说明：先以对外联系人+账户手机打底（详情拉取失败时不至于空白），客服电话随后被详情预填覆盖
    setForm({ ...blankForm, contactPerson: selfContactPerson, phone: selfPhone })
    resetDocs()
    setFlow('claim')
    setPhase('form')
    void prefillClaim()
  }

  /** 拉取所选商家详情预填认领表单（互联网信息不可信原则：预填后仍由认领人逐项核对修正） */
  const prefillClaim = async () => {
    if (!selected) return
    setClaimLoading(true)
    try {
      const d = await getMerchantDetail(selected.id)
      if (d) {
        // 改动说明：联系人默认取登录昵称（可改），其余字段含客服电话预填爬虫值供核对
        //   （客服电话是商户对外公开号，不是申请人手机，故不覆盖为账户值）
        setForm({
          name: d.name || selected.name || '',
          companyName: d.companyName || '',
          type: MERCHANT_TYPES.find((x) => x.label === d.type)?.value ?? 0,
          contactPerson: selfContactPerson || d.contactPerson || '',
          // 改动说明：客服电话优先商户已有对外电话（爬虫值供核对），无值时回退登录账号手机号
          phone: d.phone || d.mobile || selfPhone,
          address: d.address || '',
          unifiedSocialCreditCode: '',
          description: ''
        })
      }
    } catch { /* 详情拉取失败则保留手填 */ } finally { setClaimLoading(false) }
  }

  /** 展开或收起一条提名的补资料表单 */
  const onOpenInvite = (item: PendingNomination) => {
    setOpenCode(item.invitationCode === openCode ? null : item.invitationCode)
    // 改动说明：补资料时对外联系人预填登录昵称、客服电话预填登录账号手机号（均可改）；材料槽位每次展开重清
    setAcceptForm({ companyName: '', creditCode: '', contactPerson: selfContactPerson, mobile: selfPhone, address: '' })
    resetDocs()
  }

  /** 接受提名：补资料提交后提示成功并刷新提名与入驻状态 */
  const onAccept = async (code: string) => {
    if (accepting) return
    // 改动说明：企业名称必填（与后端 AcceptNomination 校验同口径）
    if (!acceptForm.companyName.trim()) {
      Taro.showToast({ title: '请填写企业名称（营业执照全称）', icon: 'none' })
      return
    }
    // 改动说明（v1.7.0）：接受提名补资料同样必传营业执照；若提名的商户类型为授权经销商，
    //   后端矩阵会再要品牌授权书（400 文案透传引导补传）
    if (!docSlots.license) {
      Taro.showToast({ title: '请上传营业执照', icon: 'none' })
      return
    }
    setAccepting(true)
    try {
      await acceptNomination(code, {
        companyName: acceptForm.companyName.trim() || undefined,
        unifiedSocialCreditCode: acceptForm.creditCode.trim() || undefined,
        contactPerson: acceptForm.contactPerson.trim() || undefined,
        mobile: acceptForm.mobile.trim() || undefined,
        address: acceptForm.address.trim() || undefined,
        documents: buildDocs()
      })
      showConfirmDialog({
        title: '提交成功',
        content: '资料已提交，等待平台审核通过后即可开始经营。',
        showCancel: false
      }).then(() => { loadInvites(); void fetchApplications() })
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '接受提名失败', icon: 'none' })
    } finally { setAccepting(false) }
  }

  /** 弹出商家类型选择动作面板 */
  const pickType = (_current: number, setter: (v: number) => void) => {
    Taro.showActionSheet({ itemList: MERCHANT_TYPES.map((x) => x.label) })
      .then((res) => {
        const item = MERCHANT_TYPES[res.tapIndex]
        if (item) setter(item.value)
      })
      .catch(() => { /* 用户取消选择 */ })
  }

  /** 编辑模式提交：修改资料重新提交被拒申请（Suspended→Pending 重走审核） */
  const onResubmit = async () => {
    if (!form.name.trim()) {
      Taro.showToast({ title: '请填写商家名称', icon: 'none' })
      return
    }
    if (!form.companyName.trim()) {
      Taro.showToast({ title: '请填写企业名称（营业执照全称）', icon: 'none' })
      return
    }
    // 改动说明（v1.7.0）：类型必填 + 材料矩阵校验（与后端同口径）
    const de = docsError(form.type)
    if (de) { Taro.showToast({ title: de, icon: 'none' }); return }
    setSubmitting(true)
    try {
      const r = await resubmitApplication(editMerchantId, {
        name: form.name.trim(),
        type: form.type || undefined,
        contactPerson: form.contactPerson.trim() || undefined,
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        companyName: form.companyName.trim(),
        unifiedSocialCreditCode: form.unifiedSocialCreditCode.trim() || undefined,
        description: form.description.trim() || undefined,
        documents: buildDocs()
      })
      Taro.showToast({ title: r?.message || '已重新提交，等待审核', icon: 'none' })
      void fetchApplications()
      setTimeout(() => Taro.navigateBack(), 800)
    } catch (e: any) {
      // 后端守卫失败（状态已变/名称撞他人/必填缺失）文案原样透传
      Taro.showToast({ title: e?.message || '重新提交失败', icon: 'none' })
    } finally { setSubmitting(false) }
  }

  /** 统一提交入口：按 flow 分发到认领 / 自营 / 提名三类请求 */
  const onSubmit = async () => {
    if (submitting) return
    if (!isLoggedIn) {
      Taro.showToast({ title: '请先登录后再申请入驻', icon: 'none' })
      return
    }

    // 编辑模式直达重提通道（v2.6.0）
    if (editing) {
      await onResubmit()
      return
    }

    if (flow === 'claim') {
      if (!selected) {
        Taro.showToast({ title: '请先选择要认领的商家', icon: 'none' })
        return
      }
      if (!form.name.trim()) {
        Taro.showToast({ title: '请核对并填写商家名称', icon: 'none' })
        return
      }
      // 改动说明：企业名称必填（后端 ApplyMerchant 同口径校验，防绕过）
      if (!form.companyName.trim()) {
        Taro.showToast({ title: '请填写企业名称（营业执照全称）', icon: 'none' })
        return
      }
      // 改动说明（v1.7.0）：类型必填 + 随单材料矩阵校验
      const de = docsError(form.type)
      if (de) { Taro.showToast({ title: de, icon: 'none' }); return }
      setSubmitting(true)
      try {
        // 改动说明：认领随第三步核对/补全的资料一并提交，后端 ApplyClaim 应用并置 Manual
        const r = await applyMerchant({
          mode: 'claim',
          claimMerchantId: selected.id,
          name: form.name.trim(),
          type: form.type || undefined,
          contactPerson: form.contactPerson.trim() || undefined,
          phone: form.phone.trim() || undefined,
          address: form.address.trim() || undefined,
          companyName: form.companyName.trim() || undefined,
          unifiedSocialCreditCode: form.unifiedSocialCreditCode.trim() || undefined,
          description: form.description.trim() || undefined,
          documents: buildDocs()
        })
        Taro.showToast({ title: r?.message || '认领申请已提交，可在"商户"页查看进度', icon: 'none' })
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
      // 改动说明：企业名称必填（后端 ApplyMerchant 同口径校验，防绕过）
      if (!form.companyName.trim()) {
        Taro.showToast({ title: '请填写企业名称（营业执照全称）', icon: 'none' })
        return
      }
      // 改动说明（v1.7.0）：类型必填 + 随单材料矩阵校验
      const de = docsError(form.type)
      if (de) { Taro.showToast({ title: de, icon: 'none' }); return }
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
          description: form.description.trim() || undefined,
          documents: buildDocs()
        })
        Taro.showToast({ title: r?.message || '入驻申请已提交，可在"商户"页查看进度', icon: 'none' })
        void fetchApplications()
        setTimeout(() => Taro.navigateBack(), 800)
      } catch (e: any) {
        // 改动说明：后端查重发现撞名且该商户可认领时返回 409 + code，引导用户改为认领而非重复新建；
        //   保留当前已填表单（不清空），仅切 flow=claim + selected，用户核对后再次点击即走认领提交
        if (e?.code === 'MERCHANT_CLAIMABLE_EXISTS' && e?.data?.existingMerchantId) {
          const emId = String(e.data.existingMerchantId)
          const emName = String(e.data.existingName || form.name.trim())
          showConfirmDialog({
            title: '库中已有此商户',
            content: `「${emName}」已存在但尚未被认领，是否改为认领？选"改名新建"可换个名称再自助入驻。`,
            confirmText: '改为认领',
            cancelText: '改名新建'
          })
            .then((ok) => {
              if (ok) {
                setSelected({ id: emId, name: emName })
                setFlow('claim')
                Taro.showToast({ title: '已切换到认领，请核对资料后再次提交', icon: 'none' })
              }
            })
        } else {
          Taro.showToast({ title: e?.message || '入驻申请提交失败', icon: 'none' })
        }
      } finally { setSubmitting(false) }
      return
    }

    // flow === 'nominate'
    if (!/^1\d{10}$/.test(nomineePhone)) {
      Taro.showToast({ title: '请填写被提名人正确的手机号', icon: 'none' })
      return
    }
    // 提名新建才需填商户名称；提名认领已有商家用所选商家本身信息，无需名称
    if (!selected && !nomName.trim()) {
      Taro.showToast({ title: '请填写商家名称', icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      // 改动说明：selected 非空=向已有未认证商家发提名认领邀请（后端不新建、成员审核时建）；
      //   为空=提名新建（后端建 Draft）
      // 改动说明：不再传 initiatorJoins——后端默认 true，发起人固定以员工身份入伙
      await nominateMerchant(
        selected
          ? { targetMerchantId: selected.id, nomineePhone }
          : {
              nomineePhone,
              name: nomName.trim(),
              type: nomType || undefined,
              companyName: nomCompanyName.trim() || undefined,
              address: nomAddress.trim() || undefined
            }
      )
      showConfirmDialog({
        title: '提名已发出',
        content: '被提名人接受提名并补全资料后即可提交审核，你也可以稍后在商户页查看进度。',
        showCancel: false
      }).then(() => Taro.navigateBack())
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
                  {fieldColumn('企业名称 *', acceptForm.companyName, (v) => setAcceptForm((p) => ({ ...p, companyName: v })), '必填，营业执照上的企业名称')}
                  {fieldColumn('统一社会信用代码', acceptForm.creditCode, (v) => setAcceptForm((p) => ({ ...p, creditCode: v })), '18位信用代码（选填）')}
                  {fieldColumn('联系人', acceptForm.contactPerson, (v) => setAcceptForm((p) => ({ ...p, contactPerson: v })), '您的姓名')}
                  {fieldColumn('客服电话', acceptForm.mobile, (v) => setAcceptForm((p) => ({ ...p, mobile: v })), '顾客可见，可填 400/座机/手机')}
                  {fieldColumn('地址', acceptForm.address, (v) => setAcceptForm((p) => ({ ...p, address: v })), '经营地址（选填）')}
                {/* v1.7.0 补资料随单材料：执照必传；授权书按被提名商户类型由后端矩阵判定（400 透传引导） */}
                {docRow('营业执照', true, 'license', 1, '盖章清晰，须与企业名称一致')}
                {docRow('品牌授权书', false, 'authorization', 2, '被提名商户为授权经销商时必备')}
                {docRow('厂房照片', false, 'factory', 3, '生产厂家选传')}
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

  /** 第二步 操作方式：两条路径都给"我当管理员 / 邀请别人当管理员"两卡（多管理员/员工走成员管理） */
  const renderMode = () => {
    if (selected) {
      return (
        <View>
          <Text style={{ ...fs(13), color: t.textSecondary, marginBottom: 10 }}>已选择商家，请选择入驻方式：</Text>
          <View style={{ backgroundColor: t.bgCard, borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <Text style={{ ...fs(16), color: t.textPrimary }}>{selected.name}</Text>
            {selected.companyName ? <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 4 }}>{selected.companyName}</Text> : null}
            <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 4 }}>类型：{selected.type}</Text>
          </View>
          {optionCard('store', '我当管理员经营', '认领该商家并核对资料，由你作为管理员维护', onClaimGo)}
          {optionCard('user-plus', '邀请别人当管理员', '把该商家提名给他人认领，你以员工身份入伙', onNominateGo)}
          <Text style={{ ...fs(12), color: t.textTertiary }}>
            无论哪种方式都需平台审核通过后生效；生效后可在成员管理里再添加其他员工或管理员。
          </Text>
        </View>
      )
    }
    return (
      <View>
        <Text style={{ ...fs(13), color: t.textSecondary, marginBottom: 12 }}>新建商户，请选择入驻方式：</Text>
        {optionCard('store', '我当管理员经营', '新建商户并由你担任管理员，提交资料后等待审核', onSelfGo)}
        {optionCard('user-plus', '邀请别人当管理员', '新建商户并提名他人为管理员，对方接受后补资料', onNominateGo)}
      </View>
    )
  }

  /** 第三步 提交：按 flow 渲染认领确认 / 自营表单 / 提名表单 */
  const renderForm = () => {
    let body: any = null
    let buttonLabel = '提交'
    // 我当管理员：认领(预填可编辑) 与 新建(空可编辑) 共用同一份可编辑表单
    if ((flow === 'claim' && selected) || flow === 'self') {
      const isClaim = flow === 'claim'
      body = (
        <View>
          <Text style={{ ...fs(13), color: t.textTertiary, marginBottom: 12 }}>
            {editing
              ? '已按原申请预填资料，修改后重新提交将再次进入平台审核。'
              : (isClaim
                ? (claimLoading ? '正在载入商家现有资料…' : '以下为商家现有资料，请逐项核对并修正（互联网信息不可信），无误后提交认领。')
                : '请填写商户资料，提交后等待平台审核。')}
          </Text>
          <View style={{ borderRadius: 12, overflow: 'hidden' }}>
            {fieldRow('商家名称', <Input style={inputStyle} value={form.name} maxlength={50} placeholder="必填，对外展示名称" placeholderClass="auth-ph" onInput={(e) => setField('name', e.detail.value)} />)}
            {fieldRow('商家类型 *', (
              <View style={{ flexDirection: 'row', alignItems: 'center' }} onClick={() => pickType(form.type, (v) => setField('type', v))}>
                <Text style={{ ...fs(15), color: form.type ? t.textPrimary : t.textTertiary }}>
                  {MERCHANT_TYPES.find((x) => x.value === form.type)?.label || '请选择'}
                </Text>
                <Icon name="chevron-right" size={16} color={t.textTertiary} />
              </View>
            ))}
            {fieldRow('企业名称 *', <Input style={inputStyle} value={form.companyName} maxlength={100} placeholder="必填，营业执照上的企业名称" placeholderClass="auth-ph" onInput={(e) => setField('companyName', e.detail.value)} />)}
            {fieldRow('信用代码', <Input style={inputStyle} value={form.unifiedSocialCreditCode} maxlength={30} placeholder="18位统一社会信用代码（选填）" placeholderClass="auth-ph" onInput={(e) => setField('unifiedSocialCreditCode', e.detail.value)} />)}
            {fieldRow('联系人', <Input style={inputStyle} value={form.contactPerson} maxlength={30} placeholder="负责人姓名" placeholderClass="auth-ph" onInput={(e) => setField('contactPerson', e.detail.value)} />)}
            {fieldRow('客服电话', <Input style={inputStyle} value={form.phone} maxlength={20} placeholder="顾客可见，可填 400/座机/手机（选填）" placeholderClass="auth-ph" onInput={(e) => setField('phone', e.detail.value)} />)}
            {fieldRow('地址', <Input style={inputStyle} value={form.address} maxlength={100} placeholder="经营地址（选填）" placeholderClass="auth-ph" onInput={(e) => setField('address', e.detail.value)} />)}
            {fieldRow('简介', <Input style={inputStyle} value={form.description} maxlength={200} placeholder="一句话介绍（选填）" placeholderClass="auth-ph" onInput={(e) => setField('description', e.detail.value)} />)}
            {/* v1.7.0 随单材料区：营业执照全类型必备；授权书随类型 2（授权经销商）条件出现；厂房照随类型 1（生产厂家）可选 */}
            {docRow('营业执照', true, 'license', 1, '盖章清晰，须与企业名称一致')}
            {form.type === 2 && docRow('品牌授权书', true, 'authorization', 2, '品牌方授权证明，防假冒授权')}
            {form.type === 1 && docRow('厂房照片', false, 'factory', 3, '选传，用于认证加分')}
          </View>
        </View>
      )
      buttonLabel = editing ? '重新提交申请' : (isClaim ? '提交认领申请' : '提交入驻申请')
    } else if (flow === 'nominate' && selected) {
      // 提名认领已有商家：展示所选商家 + 被提名人手机号 + 发起人是否入伙
      body = (
        <View>
          <Text style={{ ...fs(13), color: t.textTertiary, marginBottom: 12 }}>
            把以下商家提名给他人认领，对方接受并补全资料后提交审核。
          </Text>
          <View style={{ backgroundColor: t.bgCard, borderRadius: 12, padding: 14, marginBottom: 12 }}>
            <Text style={{ ...fs(16), color: t.textPrimary }}>{selected.name}</Text>
            {selected.companyName ? <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 4 }}>{selected.companyName}</Text> : null}
            <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 4 }}>类型：{selected.type}</Text>
          </View>
          {fieldColumn('被提名人手机号 *', nomineePhone, setNomineePhone, '对方需已注册的手机号', 'number')}
          {/* 改动说明：原"我同时以员工身份加入"勾选框已移除，发起人固定以员工身份入伙 */}
          <Text style={{ ...fs(13), color: t.textTertiary, marginTop: 4, marginBottom: 16 }}>
            你将默认以员工身份加入该商户，管理员权限在审核通过后生效。
          </Text>
        </View>
      )
      buttonLabel = '发出认领提名邀请'
    } else {
      // 提名新建：发起人代填新商户信息 + 被提名人手机号
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
          {/* 改动说明：原"我同时以员工身份加入"勾选框已移除，发起人固定以员工身份入伙 */}
          <Text style={{ ...fs(13), color: t.textTertiary, marginTop: 4, marginBottom: 16 }}>
            你将默认以员工身份加入该商户，管理员权限在审核通过后生效。
          </Text>
        </View>
      )
      buttonLabel = '发出提名邀请'
    }

    return (
      <View>
        {/* 编辑模式无"上一步"（向导相位不适用），返回即退出页面 */}
        {!editing && (
          <View
            style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}
            onClick={() => setPhase('mode')}
          >
            <Icon name="chevron-left" size={16} color={t.textSecondary} />
            <Text style={{ ...fs(13), color: t.textSecondary }}>返回上一步</Text>
          </View>
        )}
        {body}
        {submitButton(buttonLabel)}
      </View>
    )
  }

  /** 逐级回退：form(3)→mode(2)→search(1) 返回 true 已消费；search/invite 返回 false 交还系统退出 */
  const stepBack = (): boolean => {
    // 编辑模式无向导相位可回退，直接交还系统退出页面
    if (editing) return false
    if (phase === 'form') {
      setPhase('mode')
      return true
    }
    if (phase === 'mode') {
      setPhase('search')
      return true
    }
    return false
  }

  /** NavBar 箭头返回：先逐级回退，回到第一步后再退出页面 */
  const onWizardBack = () => {
    if (!stepBack()) Taro.navigateBack()
  }

  // 改动说明：拦截 RN 系统/手势返回，复用同一逐级回退逻辑，
  //   修复按系统返回键直接 pop 整个向导页、越过 3→2→1 逐级退的问题
  useHardwareBack(stepBack)

  return (
    <PageLayout nav={<NavBar title={editing ? '修改入驻申请' : '商家入驻'} showBack onBack={onWizardBack} />}>
      <View style={{ padding: 16 }}>
        {phase === 'invite' ? renderInvite() : (
          <View>
            {!editing && stepBar}
            {phase === 'search' && renderSearch()}
            {phase === 'mode' && renderMode()}
            {phase === 'form' && renderForm()}
          </View>
        )}
      </View>
    </PageLayout>
  )
}
