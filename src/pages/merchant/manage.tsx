// 商户商品管理页（v1.7.3 重构）
// 列表 + 行内添加/编辑表单 + 上下架。
// 改动说明：
//   2. 添加商品改为"搜索选平台已有型号 + 填市场描述"（1688 上架同款交互）——
//      原 createMyBearing 传 bearingPartNumber/price/stock 与后端 BearingId/PriceDescription 契约完全对不上，提交必失败；
//   3. 行新增"编辑"（价格/库存/起订量/备注四项描述，PUT 后重新进审核）；
//   4. 商品状态（v2.15.0 状态统一）：仓库中 / 审核中 / 出售中 / 已驳回 / 补充中 / 已下架；
//      列表右侧状态徽标由 reviewStatus + saleState 派生，支持对应页签筛选。
import { useState } from 'react'
import { View, Text, Input, Image } from '@tarojs/components'
import { vibrateSuccess } from '../../utils/haptics'
import Icon from '../../components/Icon'
import MediaImage from '../../components/MediaImage'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import { useMerchantStore } from '../../stores/merchant'
import { formatPriceText } from '../../utils/format'
import {
  getMyBearings, createMyBearing, updateMyBearing, putOnShelf, takeOffShelf, restockBearing, deleteMyBearing,
  uploadBearingImage, deleteBearingImage, reorderBearingImages,
  type MerchantBearingItem
} from '../../services/merchant'
// v1.7.56 商品实拍图：选图复用跨端 pickImagePath（RN 走 expo-image-picker）
import { pickImagePath } from '../../services/pickImage'
import { searchBearings, type Bearing } from '../../services/bearing'
// v2.3.0 商城置顶卡：目录/兑换（花轴承币买曝光，履约=该型号商家列表置顶 N 小时）
import { getMallItems, redeemMallItem, MALL_CATEGORY, type MallCatalog } from '../../services/mall'
// 改动说明（v2.10.0 商家金）：支付面板读站点配置的商家金兑换率显示个人代付折算价
import { getSiteConfig } from '../../services/config-api'
import { getTreasury } from '../../services/gifts'
import { showConfirmDialog } from '../../components/ConfirmDialog'

const PAGE_SIZE = 20

/**
 * 商品状态说明条目（v1.7.55）
 * 改动说明：商家此前只能看到状态角标，不知道各状态含义与上架流程，容易误以为"添加完就在卖"。
 * 文案与 stateBadgeText 的判定顺序保持一致（审核位优先、其次销售态）。
 */
const GUIDE_STATES: { name: string; desc: string }[] = [
  { name: '仓库中', desc: '刚添加，只有你自己可见。点"状态"选上架才会提交平台审核。' },
  { name: '审核中', desc: '平台审核中，通过后自动上架；未通过会显示驳回原因。' },
  { name: '已驳回', desc: '按驳回原因修改后重新提交审核即可。' },
  { name: '出售中', desc: '已上架公开：出现在商城与型号详情的在售商家，可被搜索、被邀请；并计入牌级的在售件数。' },
  { name: '补货中', desc: '暂不接单，但仍参与寻货匹配；补货后切回出售中。' },
  { name: '已下架', desc: '不对外展示；重新上架不需要再次审核。' },
]

/** 添加/编辑表单值 */
interface FormState {
  priceDescription: string
  stockDescription: string
  minOrderDescription: string
  remarks: string
}
const EMPTY_FORM: FormState = { priceDescription: '', stockDescription: '', minOrderDescription: '', remarks: '' }

/** 列表筛选态：全部 / 仓库中 / 审核中 / 出售中 / 已驳回（v2.15.0 状态统一） */
type Filter = 'all' | 'warehouse' | 'pending' | 'onSale' | 'rejected'

/** v2.15.0 状态统一：列表右侧状态徽标文案（审核位优先，其次销售态） */
function stateBadgeText(item: MerchantBearingItem): string {
  if (item.reviewStatus === 0) return '仓库中'
  if (item.reviewStatus === 3) return '已驳回'
  if (item.reviewStatus === 1) return '审核中'
  if (item.saleState === 1) return '出售中'
  if (item.saleState === 2) return '补货中'
  return '已下架'
}

/** v2.15.0 状态统一：状态徽标色（绿=出售中，橙=审核中/补货中，红=已驳回，灰=仓库中/已下架） */
function stateBadgeColor(item: MerchantBearingItem, t: any): string {
  // 改动说明（v2.13.2 配色统一）：硬编码色改走主题 token（原先绿/橙/红/灰为另一套值，与主题分叉）
  if (item.reviewStatus === 0) return t.textTertiary
  if (item.reviewStatus === 3) return t.danger
  if (item.reviewStatus === 1) return t.warning
  if (item.saleState === 1) return t.success
  if (item.saleState === 2) return t.warning
  return t.textTertiary
}

/** v2.15.0 状态统一：筛选态 → 查询参数（审核位/在售） */
function filterParams(f: Filter): { onlyOnSale?: boolean; reviewStatus?: number } {
  if (f === 'onSale') return { onlyOnSale: true }
  if (f === 'warehouse') return { reviewStatus: 0 }
  if (f === 'pending') return { reviewStatus: 1 }
  if (f === 'rejected') return { reviewStatus: 3 }
  return {}
}

export default function MerchantManagePage() {
  const t = useTheme()
  const fs = useFs()
  // 改动说明 B5：按当前选中商户判定角色（原 merchants[0] 写死首个，多商户切换失效）
  const cur = useMerchantStore((s) => s.merchants.find((m) => m.merchantId === s.currentMerchantId) ?? s.merchants[0] ?? null)
  const isAdmin = cur?.role === 'MerchantAdmin'

  const [items, setItems] = useState<MerchantBearingItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  // 改动说明（v1.7.55 商品状态说明）：说明卡默认收起，只占一行，不打断列表浏览
  const [guideOpen, setGuideOpen] = useState(false)

  // 添加表单：null=收起；searchKw/搜索结果/已选型号
  const [adding, setAdding] = useState(false)
  const [searchKw, setSearchKw] = useState('')
  const [searchList, setSearchList] = useState<Bearing[]>([])
  const [picked, setPicked] = useState<Bearing | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  // 编辑中的关联行 id（null=不在编辑）
  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // v1.7.56 商品实拍图：新建时先存本地路径，创建成功后再逐张上传；imgBusy 防止连点重复上传
  const [pendingImages, setPendingImages] = useState<string[]>([])
  const [imgBusy, setImgBusy] = useState(false)
  // 搜索防抖句柄
  let searchTimer: ReturnType<typeof setTimeout> | null = null

  const load = (p: number, append: boolean) => {
    if (loading) return
    setLoading(true)
    getMyBearings({
      page: p,
      pageSize: PAGE_SIZE,
      ...filterParams(filter)
    })
      .then((r) => {
        setItems((prev) => (append ? [...prev, ...(r?.items ?? [])] : r?.items ?? []))
        setTotal(r?.totalCount ?? 0)
        setPage(p)
      })
      .catch(() => { /* 拉取失败 */ })
      .finally(() => setLoading(false))
  }

  useDidShow(() => {
    load(1, false)
  })

  /** 切换筛选并重查 */
  const switchFilter = (f: Filter) => {
    if (f === filter) return
    setFilter(f)
    setLoading(false)
    // 用新 filter 直接拉第一页（load 读 state 有滞后，这里显式传参重查）
    setLoading(true)
    getMyBearings({
      page: 1,
      pageSize: PAGE_SIZE,
      ...filterParams(f)
    })
      .then((r) => {
        setItems(r?.items ?? [])
        setTotal(r?.totalCount ?? 0)
        setPage(1)
      })
      .catch(() => { /* 拉取失败 */ })
      .finally(() => setLoading(false))
  }

  const onToggleShelf = (item: MerchantBearingItem) => {
    // 改动说明（v2.15.0 修复）：上下架/补货的 API 路由以"关联主键 item.id"为参数，原误传 item.bearingId
    // （平台轴承 ID），导致命中"关联不存在"而失败；编辑一直用 item.id 故未暴露。
    // 改动说明（v1.7.21 三态销售状态）：上/下架二选一升级为 ActionSheet 三态——
    // 在售 / 补货中（可选填预计到货）/ 下架；补货中在买家侧商家列表仍展示带徽标
    Taro.showActionSheet({ itemList: ['置为在售', '置为补货中', '置为下架'] })
      .then(async (res) => {
        if (res.tapIndex < 0) return
        setBusyId(item.id)
        try {
          if (res.tapIndex === 0) {
            await putOnShelf(item.id)
          } else if (res.tapIndex === 1) {
            // eta 可选：showModal editable（H5/小程序支持编辑；RN 端不支持 editable，
            // Taro 类型未声明该字段——cast 绕过，RN 上退化为确认框、eta 留空）
            let eta = ''
            const m: any = await (Taro.showModal as any)({
              title: '置为补货中',
              content: '可填写预计到货时间（可空）',
              editable: true,
              placeholderText: '如：一周内',
            }).catch(() => null)
            if (!m || !m.confirm) { setBusyId(null); return }
            eta = (m.content || '').trim()
            await restockBearing(item.id, eta || undefined)
          } else {
            await takeOffShelf(item.id)
          }
          void vibrateSuccess()
          Taro.showToast({ title: '操作成功', icon: 'success' })
          load(page, false)
        } catch (e: any) {
          Taro.showToast({ title: e?.message || '操作失败', icon: 'none' })
        } finally {
          setBusyId(null)
        }
      })
      .catch(() => { /* 取消 */ })
  }

  /** 删除商品（v2.15.0 商家删除）：出售中/补货中前置引导先下架（后端亦守卫）；否则二次确认后物理删除 */
  const onDelete = async (item: MerchantBearingItem) => {
    if (item.saleState === 1 || item.saleState === 2) {
      Taro.showToast({ title: '出售中/补货中的商品请先下架再删除', icon: 'none' })
      return
    }
    const ok = await showConfirmDialog({ title: '删除商品', content: `确定删除「${item.bearingPartNumber}」？删除后不可恢复。` })
    if (!ok) return
    setBusyId(item.id)
    try {
      await deleteMyBearing(item.id)
      void vibrateSuccess()
      Taro.showToast({ title: '已删除', icon: 'success' })
      load(page, false)
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '删除失败', icon: 'none' })
    } finally {
      setBusyId(null)
    }
  }

  /**
   * 置顶（v2.3.0 商城虚拟权益）：拉目录取置顶卡 → 选时长档 → 确认花分 → 兑换。
   * targetRef 传 item.id（MerchantBearingId 关联行主键，API 侧据此校验归属与在售）；
   * requestId 为本次确认的幂等键，防连点重复扣分。
   * 余额不足不直接报错，而是引导去任务中心赚轴承币（额度/价格前置可见原则）
   */
  const onPin = async (item: MerchantBearingItem) => {
    if (item.saleState !== 1) {
      Taro.showToast({ title: '仅出售中商品可置顶', icon: 'none' })
      return
    }
    setBusyId(item.id)
    let catalog: MallCatalog | null = null
    try {
      catalog = await getMallItems()
    } catch {
      catalog = null
    }
    setBusyId(null)

    // 改动说明（v2.10.0）：本面板只列商品置顶卡（targetKind=1），需求卡走"我的寻货"
    const pins = (catalog?.items || []).filter((i) => i.category === MALL_CATEGORY.PIN_CARD && (i.targetKind ?? 1) === 1 && !i.soldOut)
    if (pins.length === 0) {
      Taro.showToast({ title: '暂无可用置顶权益', icon: 'none' })
      return
    }

    const sheet = await Taro.showActionSheet({
      // 改动说明（v2.10.0 商家金）：商品置顶卡按商家金定价（金库单位），标注清楚
      itemList: pins.map((p) => `${p.name}（${p.price} 商家金）`)
    }).catch(() => null)
    if (!sheet || sheet.tapIndex < 0) return
    const picked = pins[sheet.tapIndex]
    const balance = catalog?.balance ?? 0
    // v2.4.0 商家经济：管理员双支付通道（商家金库 / 个人轴承币代付），员工仅个人轴承币；
    // 改动说明（v2.10.0）：管理员默认金库（置顶是经营行为走金库），个人代付按汇率折算多付
    const cur = useMerchantStore.getState().currentMerchant()
    const isAdmin = cur?.role === 'MerchantAdmin'
    let treasuryBalance = 0
    if (isAdmin) {
      treasuryBalance = (await getTreasury().catch(() => null))?.balance ?? 0
    }
    const goldRate = isAdmin
      ? (await getSiteConfig().catch(() => null))?.merchantGoldPayRate ?? 2
      : 2
    const personalCost = picked.price * goldRate
    const itemList = isAdmin
      ? [`商家金库支付（${picked.price} 金，余额 ${treasuryBalance}）`, `个人轴承币代付（折算 ${personalCost} 分，余额 ${balance}）`]
      : [`个人轴承币（余额 ${balance}，本单折算 ${personalCost} 分）`]
    const pay = await Taro.showActionSheet({ itemList }).catch(() => null)
    if (!pay || pay.tapIndex < 0) return
    const useTreasury = isAdmin && pay.tapIndex === 0
    const cost = useTreasury ? picked.price : personalCost
    const payerBalance = useTreasury ? treasuryBalance : balance
    const affordable = payerBalance >= cost

    const ok = await showConfirmDialog({
      title: picked.name,
      content: affordable
        ? `用${useTreasury ? '商家金' : `个人轴承币（${picked.price} 商家金 × 汇率 ${goldRate} 折算）`}花 ${cost} 把「${item.bearingPartNumber}」在该型号商家列表置顶 ${picked.durationHours ?? 24} 小时？余额 ${payerBalance}。`
        : `需要 ${cost}${useTreasury ? ' 商家金' : ' 轴承币'}，${useTreasury ? '金库' : ''}余额 ${payerBalance}。${useTreasury ? '可让成员多赚分上供、完成集体任务或挂礼成交，或改用个人轴承币代付。' : '去任务中心赚轴承币？'}`,
      confirmText: affordable ? '确认兑换' : '去赚轴承币'
    })
    if (!ok) return
    if (!affordable) {
      Taro.navigateTo({ url: useTreasury ? '/pages/merchant/gifts' : '/pages/my/tasks' })
      return
    }

    setBusyId(item.id)
    try {
      await redeemMallItem(picked.id, item.id, `pin-${item.id}-${Date.now()}`, useTreasury)
      void vibrateSuccess()
      Taro.showToast({ title: `置顶成功 -${cost}${useTreasury ? ' 金' : ' 分'}`, icon: 'success' })
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '兑换失败', icon: 'none' })
    } finally {
      setBusyId(null)
    }
  }

  /** 型号搜索输入（300ms 防抖，命中显示可点选结果） */
  const onSearchInput = (v: string) => {
    setSearchKw(v)
    setPicked(null)
    if (searchTimer) clearTimeout(searchTimer)
    if (!v.trim()) { setSearchList([]); return }
    searchTimer = setTimeout(() => {
      searchBearings({ keyword: v.trim(), page: 1, pageSize: 8 })
        .then((r) => setSearchList(r?.items ?? []))
        .catch(() => setSearchList([]))
    }, 300)
  }

  /** 打开/收起添加表单 */
  const toggleAdd = () => {
    setAdding((v) => !v)
    setEditingId(null)
    if (adding) { setSearchKw(''); setSearchList([]); setPicked(null); setForm(EMPTY_FORM); setPendingImages([]) }
  }

  /** 新建商品时先选本地图（v1.7.56）：创建成功后才真正上传，最多 3 张 */
  const pickPendingImage = async () => {
    if (pendingImages.length >= 3) { Taro.showToast({ title: '最多 3 张图片', icon: 'none' }); return }
    const path = await pickImagePath()
    if (!path) return
    setPendingImages((prev) => (prev.length >= 3 ? prev : [...prev, path]))
  }

  /** 提交添加：需先选中平台型号；创建成功后按返回 id 依次上传已选实拍图 */
  const onCreate = async () => {
    if (!picked) { Taro.showToast({ title: '请先搜索并选择轴承型号', icon: 'none' }); return }
    if (submitting) return
    setSubmitting(true)
    try {
      const r = await createMyBearing({
        bearingId: picked.id,
        priceDescription: form.priceDescription.trim() || undefined,
        stockDescription: form.stockDescription.trim() || undefined,
        minOrderDescription: form.minOrderDescription.trim() || undefined,
        remarks: form.remarks.trim() || undefined
      })
      // v1.7.56 图片依赖新建返回的关联 id，不能再只回 message
      let failed = 0
      if (r?.id && pendingImages.length > 0) {
        for (const path of pendingImages) {
          const up = await uploadBearingImage(r.id, path)
          if (!up.success) failed++
        }
      }
      Taro.showToast({
        title: failed > 0 ? `商品已添加，${failed} 张图片上传失败` : (r?.message || '添加成功，已放入仓库中'),
        icon: 'none'
      })
      setAdding(false); setSearchKw(''); setSearchList([]); setPicked(null); setForm(EMPTY_FORM); setPendingImages([])
      load(1, false)
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '添加失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  /** 给已存在商品添加一张实拍图（v1.7.56）：已上架商品改图后重新送审 */
  const onAddImage = async (item: MerchantBearingItem) => {
    if (imgBusy) return
    setImgBusy(true)
    try {
      const r = await uploadBearingImage(item.id)
      if (r.success) {
        // 改动说明（v1.7.57）：只有已通过审核的商品改图才会重新送审，
        //   仓库中/已驳回的商品直接生效，原文案一律说"等待审核"会让商家以为卡住了
        Taro.showToast({ title: item.reviewStatus === 2 ? '图片已上传，等待审核' : '图片已上传', icon: 'none' })
        load(1, false)
      } else {
        Taro.showToast({ title: r.message || '上传失败', icon: 'none' })
      }
    } finally {
      setImgBusy(false)
    }
  }

  /** 删除一张实拍图（v1.7.56）：已上架商品删图会重新送审，故删除前二次确认（v1.7.57） */
  const onRemoveImage = async (item: MerchantBearingItem, url: string) => {
    if (imgBusy) return
    const ok = await showConfirmDialog({
      title: '删除商品图',
      content: item.reviewStatus === 2
        ? '删除后商品会重新提交平台审核，审核通过前商城暂不展示。确定删除？'
        : '确定删除这张商品图？'
    })
    if (!ok) return
    setImgBusy(true)
    try {
      await deleteBearingImage(item.id, url)
      Taro.showToast({ title: '图片已删除', icon: 'none' })
      load(1, false)
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '删除失败', icon: 'none' })
    } finally {
      setImgBusy(false)
    }
  }

  /** 把某张图设为首图（v1.7.56）：首图决定商城与商品卡片展示 */
  const onMakeCover = async (item: MerchantBearingItem, url: string) => {
    if (imgBusy) return
    const current = item.imageUrls ?? []
    if (current[0] === url) return
    setImgBusy(true)
    try {
      await reorderBearingImages(item.id, [url, ...current.filter((u) => u !== url)])
      Taro.showToast({ title: item.reviewStatus === 2 ? '已设为首图，等待审核' : '已设为首图', icon: 'none' })
      load(1, false)
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '调整失败', icon: 'none' })
    } finally {
      setImgBusy(false)
    }
  }

  /** 进入编辑：回填四项描述 */
  const startEdit = (item: MerchantBearingItem) => {
    setAdding(false)
    setPendingImages([])
    setEditingId(item.id)
    setForm({
      priceDescription: item.priceDescription ?? '',
      stockDescription: item.stockDescription ?? '',
      minOrderDescription: item.minOrderDescription ?? '',
      remarks: item.remarks ?? ''
    })
  }

  /** 提交编辑（PUT 后重新进审核） */
  const onUpdate = () => {
    if (!editingId || submitting) return
    setSubmitting(true)
    updateMyBearing(editingId, {
      priceDescription: form.priceDescription.trim() || undefined,
      stockDescription: form.stockDescription.trim() || undefined,
      minOrderDescription: form.minOrderDescription.trim() || undefined,
      remarks: form.remarks.trim() || undefined
    })
      .then((r) => {
        Taro.showToast({ title: r?.message || '更新成功', icon: 'none' })
        setEditingId(null); setForm(EMPTY_FORM)
        load(1, false)
      })
      .catch((e: any) => Taro.showToast({ title: e?.message || '更新失败', icon: 'none' }))
      .finally(() => setSubmitting(false))
  }

  /** 表单四项描述输入行（添加/编辑共用） */
  const descRow = (label: string, key: keyof FormState, placeholder: string) => (
    <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', paddingTop: 8, paddingBottom: 8 }}>
      <Text style={{ ...fs(13), color: t.textSecondary, width: 72 }}>{label}</Text>
      <Input
        style={{ ...fs(14), color: t.textPrimary, flex: 1, backgroundColor: t.bgInput, borderRadius: 8, paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6 }}
        value={form[key]}
        placeholder={placeholder}
        placeholderClass="auth-ph" placeholderTextColor={t.textTertiary}
        onInput={(e) => setForm((prev) => ({ ...prev, [key]: e.detail.value }))}
      />
    </View>
  )

  const formActions = (onSubmit: () => void, okLabel: string) => (
    <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
      <View
        style={{ backgroundColor: t.bgInput, borderRadius: 16, paddingLeft: 18, paddingRight: 18, paddingTop: 7, paddingBottom: 7, marginRight: 10 }}
        onClick={() => { setAdding(false); setEditingId(null); setForm(EMPTY_FORM); setPicked(null) }}
      >
        <Text style={{ ...fs(13), color: t.textPrimary }}>取消</Text>
      </View>
      <View
        style={{ backgroundColor: submitting ? t.textTertiary : t.primary, borderRadius: 16, paddingLeft: 18, paddingRight: 18, paddingTop: 7, paddingBottom: 7 }}
        onClick={submitting ? undefined : onSubmit}
      >
        <Text style={{ ...fs(13), color: t.textOnPrimary }}>{submitting ? '提交中…' : okLabel}</Text>
      </View>
    </View>
  )

  const filterTab = (key: Filter, label: string) => (
    <View
      style={{ marginRight: 16, paddingBottom: 6, borderStyle: 'solid', borderWidth: 0, borderBottomWidth: 2, borderBottomColor: filter === key ? t.primary : 'transparent' }}
      onClick={() => switchFilter(key)}
    >
      <Text style={{ ...fs(14), color: filter === key ? t.primary : t.textSecondary, fontWeight: filter === key ? '600' : '400' }}>{label}</Text>
    </View>
  )

  return (
    <PageLayout nav={<NavBar title="商品管理" showBack />}>
      {/* 操作栏：添加商品（成员均可）——v1.7.3 替代原整行大按钮；改动说明：Excel 批量导入依赖外部 ETL 数据管线，本版本不提供该入口 */}
      <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', paddingLeft: 14, paddingRight: 14, paddingTop: 12, paddingBottom: 4 }}>
        <View
          style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', backgroundColor: t.primary, borderRadius: 18, paddingLeft: 14, paddingRight: 14, paddingTop: 7, paddingBottom: 7 }}
          onClick={toggleAdd}
        >
          <Icon name="plus" size={14} color={t.textOnPrimary} />
          <Text style={{ ...fs(13), color: t.textOnPrimary, marginLeft: 4 }}>添加商品</Text>
        </View>
      </View>

      {/* 改动说明（v1.7.55 商品状态说明）：商家不知道各状态区别与上架需审核，新增可折叠说明卡；
          放在添加按钮下方、筛选页签上方——进页第一眼可见，收起后只占一行 */}
      <View style={{ marginLeft: 14, marginRight: 14, marginTop: 8, backgroundColor: t.bgCard, borderRadius: 12, paddingLeft: 12, paddingRight: 12, paddingTop: 10, paddingBottom: 10 }}>
        <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }} onClick={() => setGuideOpen(!guideOpen)}>
          <Icon name="info" size={14} color={t.primary} />
          <Text style={{ ...fs(13), color: t.textPrimary, flex: 1, marginLeft: 6 }}>商品状态与上架说明</Text>
          <Icon name={guideOpen ? 'chevron-up' : 'chevron-down'} size={16} color={t.textTertiary} />
        </View>
        {guideOpen && (
          <View style={{ marginTop: 8 }}>
            <Text style={{ ...fs(12), color: t.textSecondary, lineHeight: 18 }}>
              在售 = 通过平台审核 + 你点了上架（出售中）。只有出售中的商品会出现在商城和型号详情的“在售商家”里，
              买家能搜到你、给你发寻货邀请；商城只展示已认证商家的出售中商品。
            </Text>
            <View style={{ marginTop: 8 }}>
              {GUIDE_STATES.map((g) => (
                <View key={g.name} style={{ display: 'flex', flexDirection: 'row', marginTop: 6 }}>
                  <Text style={{ ...fs(12), color: t.textPrimary, width: 52 }}>{g.name}</Text>
                  <Text style={{ ...fs(12), color: t.textTertiary, flex: 1, lineHeight: 17 }}>{g.desc}</Text>
                </View>
              ))}
            </View>
            <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 8, lineHeight: 16 }}>
              注意：修改价格、库存、起订量或备注会重新提交审核，通过前商品会暂时从商城与详情页隐藏。
            </Text>
          </View>
        )}
      </View>

      {/* 添加表单（内联展开）：搜索选型号 + 四项描述 */}
      {adding && (
        <View style={{ marginLeft: 14, marginRight: 14, marginTop: 8, marginBottom: 4, backgroundColor: t.bgCard, borderRadius: 12, padding: 12 }}>
          <Text style={{ ...fs(14), color: t.textPrimary, marginBottom: 8 }}>选择轴承型号</Text>
          <Input
            style={{ ...fs(14), color: t.textPrimary, backgroundColor: t.bgInput, borderRadius: 8, paddingLeft: 10, paddingRight: 10, paddingTop: 8, paddingBottom: 8 }}
            value={searchKw}
            placeholder="输入型号关键词搜索平台轴承库"
            placeholderClass="auth-ph" placeholderTextColor={t.textTertiary}
            onInput={(e) => onSearchInput(e.detail.value)}
          />
          {picked && (
            <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginTop: 8, backgroundColor: t.bgInput, borderRadius: 8, paddingLeft: 10, paddingRight: 10, paddingTop: 8, paddingBottom: 8 }}>
              <Text style={{ ...fs(13), color: t.primary, flex: 1 }} numberOfLines={1}>
                已选：{picked.brandName ? `${picked.brandName} ` : ''}{picked.partNumber}{picked.bearingType ? ` · ${picked.bearingType}` : ''}
              </Text>
              <Text style={{ ...fs(13), color: t.textTertiary }} onClick={() => { setPicked(null); setSearchList([]) }}>重选</Text>
            </View>
          )}
          {!picked && searchList.length > 0 && (
            <View style={{ marginTop: 8 }}>
              {/* 改动说明（v1.5.0）：候选列表不再 maxHeight 裁切滚动（关滚动条后像被压住/显示不全），
                  改完整渲染前 5 条 + "还有更多"提示，与应答页在售选择同款闭环 */}
              {searchList.slice(0, 5).map((b) => (
                <View
                  key={b.id}
                  style={{ borderStyle: 'solid', borderWidth: 0, borderBottomWidth: 1, borderBottomColor: t.border, paddingTop: 8, paddingBottom: 8 }}
                  onClick={() => { setPicked(b); setSearchList([]); setSearchKw(b.partNumber) }}
                >
                  <Text style={{ ...fs(14), color: t.textPrimary }}>{b.partNumber}</Text>
                  <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 2 }}>
                    {[b.brandName, b.bearingType, `${b.innerDiameter}×${b.outerDiameter}×${b.width}`].filter(Boolean).join(' · ') || '—'}
                  </Text>
                </View>
              ))}
              {searchList.length > 5 && (
                <Text style={{ ...fs(11), color: t.textTertiary, paddingTop: 8, paddingBottom: 2 }}>还有更多，输入更精确的型号关键词收窄结果</Text>
              )}
            </View>
          )}
          {!picked && !!searchKw.trim() && searchList.length === 0 && (
            <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 8 }}>未找到型号；平台库没有的型号可先在家页搜索确认，或反馈纠错新增</Text>
          )}
          <View style={{ marginTop: 6 }}>
            {descRow('价格', 'priceDescription', '如：28元/个，量大优惠')}
            {descRow('库存', 'stockDescription', '如：现货 500 个')}
            {descRow('起订量', 'minOrderDescription', '如：10 个起订')}
            {descRow('备注', 'remarks', '选填')}
          </View>
          {/* v1.7.56 新建时先选实拍图，创建成功后自动上传；不选也能提交，商城回退型号主图 */}
          <View style={{ marginTop: 8 }}>
            <Text style={{ ...fs(13), color: t.textSecondary }}>商品实拍图（{pendingImages.length}/3，选填）</Text>
            <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 2, lineHeight: 16 }}>
              拍你手上这批货，买家在商城看到的就是第一张；不传则显示平台型号图
            </Text>
            <View style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
              {pendingImages.map((p, idx) => (
                <View key={`${p}-${idx}`} style={{ width: 68, marginRight: 8, marginBottom: 8 }}>
                  <Image src={p} mode='aspectFill' style={{ width: 68, height: 68, borderRadius: 8 }} />
                  <Text
                    style={{ ...fs(11), color: '#EF4444', marginTop: 2 }}
                    onClick={() => setPendingImages((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    移除
                  </Text>
                </View>
              ))}
              {pendingImages.length < 3 && (
                <View
                  style={{ width: 68, height: 68, borderRadius: 8, borderStyle: 'dashed', borderWidth: 1, borderColor: t.border, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
                  onClick={pickPendingImage}
                >
                  <Icon name="plus" size={16} color={t.textTertiary} />
                  <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 2 }}>添加图片</Text>
                </View>
              )}
            </View>
          </View>
          {formActions(onCreate, '提交添加')}
        </View>
      )}

      {/* 筛选页签 */}
      <View style={{ display: 'flex', flexDirection: 'row', paddingLeft: 14, paddingRight: 14, paddingTop: 10, paddingBottom: 2 }}>
        {filterTab('all', '全部')}
        {filterTab('warehouse', '仓库中')}
        {filterTab('pending', '审核中')}
        {filterTab('onSale', '出售中')}
        {filterTab('rejected', '已驳回')}
      </View>

      <View style={{ paddingLeft: 14, paddingRight: 14, marginTop: 8 }}>
        {items.length === 0 && !loading ? (
          <View style={{ display: 'flex', alignItems: 'center', paddingTop: 50 }}>
            <Icon name="box" size={40} color={t.textTertiary} />
            <Text style={{ ...fs(14), color: t.textTertiary, marginTop: 12 }}>暂无商品，点左上"添加商品"上架</Text>
            {/* 改动说明（v1.7.55）：空态补一句闭环说明——添加后还要上架并通过审核，买家才能在商城搜到 */}
            <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 6 }}>添加后点"状态"选上架，审核通过后买家才能在商城搜到你</Text>
          </View>
        ) : (
          <View style={{ borderRadius: 12, overflow: 'hidden' }}>
            {items.map((item) => (
              <View
                key={item.id}
                style={{ backgroundColor: t.bgCard, padding: 12, borderStyle: 'solid', borderWidth: 0, borderBottomWidth: 1, borderBottomColor: t.border, opacity: busyId === item.id ? 0.5 : 1 }}
              >
                <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ ...fs(15), color: t.textPrimary, flex: 1 }} numberOfLines={1}>{item.bearingPartNumber}</Text>
                  {/* v2.15.0 状态统一：右侧状态徽标（审核位优先，其次销售态），替代原双徽标 */}
                  <View style={{ width: 60, height: 20, borderRadius: 10, backgroundColor: stateBadgeColor(item, t), alignItems: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <Text style={{ ...fs(11), color: '#fff' }}>{stateBadgeText(item)}</Text>
                  </View>
                </View>
                <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 4 }}>
                  {/* 改动说明（v1.7.50）：报价是自由文本，纯数字时补 ¥，避免与库存/起订量混淆 */}
                {[item.brandName, item.bearingTypeName, formatPriceText(item.priceDescription)].filter(Boolean).join(' · ') || '暂无规格'}
                </Text>
                {/* v2.15.0 状态统一：已驳回显示理由（可改重提） */}
                {item.reviewStatus === 3 && item.approvalComment ? (
                  <Text style={{ ...fs(12), color: '#EF4444', marginTop: 4 }}>驳回原因：{item.approvalComment}</Text>
                ) : null}
                {/* 行操作：置顶（商城权益） + 编辑 + 状态 */}
                <View style={{ display: 'flex', flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
                  {item.saleState === 1 && (
                    <View
                      style={{ backgroundColor: t.bgInput, borderRadius: 6, paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, marginRight: 8 }}
                      onClick={() => onPin(item)}
                    >
                      <Text style={{ ...fs(12), color: '#F59E0B' }}>置顶</Text>
                    </View>
                  )}
                  <View
                    style={{ backgroundColor: t.bgInput, borderRadius: 6, paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, marginRight: 8 }}
                    onClick={() => (editingId === item.id ? setEditingId(null) : startEdit(item))}
                  >
                    <Text style={{ ...fs(12), color: t.primary }}>{editingId === item.id ? '收起' : '编辑'}</Text>
                  </View>
                  <View
                    style={{ backgroundColor: t.bgInput, borderRadius: 6, paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6 }}
                    onClick={() => onToggleShelf(item)}
                  >
                    <Text style={{ ...fs(12), color: t.primary }}>状态</Text>
                  </View>
                  {/* v2.15.0 商家删除：出售中/补货中点击会提示先下架 */}
                  <View
                    style={{ backgroundColor: t.bgInput, borderRadius: 6, paddingLeft: 12, paddingRight: 12, paddingTop: 6, paddingBottom: 6, marginLeft: 8 }}
                    onClick={() => onDelete(item)}
                  >
                    <Text style={{ ...fs(12), color: '#EF4444' }}>删除</Text>
                  </View>
                </View>
                {/* 编辑表单（行内展开） */}
                {editingId === item.id && (
                  <View style={{ marginTop: 8, backgroundColor: t.bgInput, borderRadius: 10, padding: 10 }}>
                    {descRow('价格', 'priceDescription', '如：28元/个，量大优惠')}
                    {descRow('库存', 'stockDescription', '如：现货 500 个')}
                    {descRow('起订量', 'minOrderDescription', '如：10 个起订')}
                    {descRow('备注', 'remarks', '选填')}
                    {/* v1.7.56 商品实拍图管理：首图决定商城展示；改图/删图/换首图后已上架商品重新送审 */}
                    <View style={{ marginTop: 10, borderStyle: 'solid', borderWidth: 0, borderTopWidth: 1, borderTopColor: t.border, paddingTop: 10 }}>
                      <Text style={{ ...fs(13), color: t.textSecondary }}>商品实拍图（{(item.imageUrls ?? []).length}/3）</Text>
                      <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 2, lineHeight: 16 }}>
                        买家在商城看到的是第一张；改图、删图或换首图后需重新审核，通过前商城暂不展示
                      </Text>
                      <View style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
                        {(item.imageUrls ?? []).map((url, idx) => (
                          <View key={url} style={{ width: 76, marginRight: 8, marginBottom: 8 }}>
                            <MediaImage url={url} mode='aspectFill' style={{ width: 76, height: 76, borderRadius: 8 }} />
                            <Text style={{ ...fs(10), color: idx === 0 ? t.primary : t.textTertiary, marginTop: 2 }}>
                              {idx === 0 ? '首图' : '商品图'}
                            </Text>
                            <View style={{ display: 'flex', flexDirection: 'row' }}>
                              {idx !== 0 && (
                                <Text style={{ ...fs(11), color: t.primary, marginRight: 8 }} onClick={() => onMakeCover(item, url)}>设为首图</Text>
                              )}
                              <Text style={{ ...fs(11), color: '#EF4444' }} onClick={() => onRemoveImage(item, url)}>删除</Text>
                            </View>
                          </View>
                        ))}
                        {(item.imageUrls ?? []).length < 3 && (
                          <View
                            style={{ width: 76, height: 76, borderRadius: 8, borderStyle: 'dashed', borderWidth: 1, borderColor: t.border, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', opacity: imgBusy ? 0.5 : 1 }}
                            onClick={() => onAddImage(item)}
                          >
                            <Icon name="plus" size={16} color={t.textTertiary} />
                            <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 2 }}>添加图片</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    {formActions(onUpdate, '保存修改')}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </View>

      {items.length < total && (
        <View
          style={{ display: 'flex', alignItems: 'center', paddingTop: 14, paddingBottom: 20 }}
          onClick={() => load(page + 1, true)}
        >
          <Text style={{ ...fs(14), color: t.textSecondary }}>{loading ? '加载中…' : '加载更多'}</Text>
        </View>
      )}
      {isAdmin && (
        <Text style={{ ...fs(11), color: t.textTertiary, paddingLeft: 14, paddingRight: 14, marginBottom: 20 }}>
          Excel 导入模板列：轴承型号 / 品牌 / 价格 / 库存数量 / 最小起订量；导入数据为商户自管，互联网数据不覆盖
        </Text>
      )}
    </PageLayout>
  )
}
