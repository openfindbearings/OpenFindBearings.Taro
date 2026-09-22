// 商户商品管理页（v1.7.3 重构）
// 列表 + 行内添加/编辑表单 + 上下架；Excel 导入降级为管理员二级入口。
// 改动说明：
//   1. 原顶部整行大蓝按钮（Excel 导入）观感差——改为操作栏两枚小按钮：
//      ＋添加商品（成员均可）、Excel 导入（仅管理员；v1.7.7 三端打通：
//      小程序会话文件 / H5 input file / RN document-picker，RN 需重装 APK 生效）；
//   2. 添加商品改为"搜索选平台已有型号 + 填市场描述"（1688 上架同款交互）——
//      原 createMyBearing 传 bearingPartNumber/price/stock 与后端 BearingId/PriceDescription 契约完全对不上，提交必失败；
//   3. 行新增"编辑"（价格/库存/起订量/备注四项描述，PUT 后重新进审核）；
//   4. 待审核商品显示"审核中"角标（isPendingApproval），支持"审核中"筛选。
import { useState } from 'react'
import { View, Text, Input, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { vibrateSuccess } from '../../utils/haptics'
import Icon from '../../components/Icon'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import { useMerchantStore } from '../../stores/merchant'
import {
  getMyBearings, createMyBearing, updateMyBearing, putOnShelf, takeOffShelf, importInventory,
  type MerchantBearingItem
} from '../../services/merchant'
import { searchBearings, type Bearing } from '../../services/bearing'
// Excel 文件选择平台分派（Metro 按 .rn 后缀解析 RN 版，H5/小程序走 index.ts）
import { chooseExcelFile } from '../../services/importExcel'

const PAGE_SIZE = 20

/** 添加/编辑表单值 */
interface FormState {
  priceDescription: string
  stockDescription: string
  minOrderDescription: string
  remarks: string
}
const EMPTY_FORM: FormState = { priceDescription: '', stockDescription: '', minOrderDescription: '', remarks: '' }

/** 列表筛选态：全部 / 在售 / 审核中 */
type Filter = 'all' | 'onSale' | 'pending'

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
  const [importing, setImporting] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')

  // 添加表单：null=收起；searchKw/搜索结果/已选型号
  const [adding, setAdding] = useState(false)
  const [searchKw, setSearchKw] = useState('')
  const [searchList, setSearchList] = useState<Bearing[]>([])
  const [picked, setPicked] = useState<Bearing | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  // 编辑中的关联行 id（null=不在编辑）
  const [editingId, setEditingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // 搜索防抖句柄
  let searchTimer: ReturnType<typeof setTimeout> | null = null

  const load = (p: number, append: boolean) => {
    if (loading) return
    setLoading(true)
    getMyBearings({
      page: p,
      pageSize: PAGE_SIZE,
      onlyOnSale: filter === 'onSale' ? true : undefined,
      pendingOnly: filter === 'pending' ? true : undefined
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
      onlyOnSale: f === 'onSale' ? true : undefined,
      pendingOnly: f === 'pending' ? true : undefined
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
    setBusyId(item.id)
    const action = item.isOnSale ? takeOffShelf : putOnShelf
    action(item.bearingId)
      .then(() => {
        // 改动说明（v1.7.13）：上下架成功触感反馈
        void vibrateSuccess()
        Taro.showToast({ title: '操作成功', icon: 'success' })
        load(page, false)
      })
      .catch((e: any) => Taro.showToast({ title: e?.message || '操作失败', icon: 'none' }))
      .finally(() => setBusyId(null))
  }

  /** Excel 批量导入（管理员，v1.7.7 三端打通）：chooseExcelFile 平台分派
   *  （小程序会话文件 / H5 input file / RN document-picker），选中后走 multipart 上传 */
  const onImport = async () => {
    if (importing) return
    let picked
    try {
      picked = await chooseExcelFile()
    } catch (e: any) {
      Taro.showToast({ title: e?.message?.includes('cancel') ? '已取消选择' : '无法打开文件选择', icon: 'none' })
      return
    }
    if (!picked) return
    setImporting(true)
    try {
      const r = await importInventory(picked.path, picked.name, picked.mimeType)
      Taro.showToast({ title: r?.message || '导入完成', icon: 'none', duration: 2500 })
      load(1, false)
    } catch {
      Taro.showToast({ title: '导入失败', icon: 'none' })
    } finally { setImporting(false) }
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
    if (adding) { setSearchKw(''); setSearchList([]); setPicked(null); setForm(EMPTY_FORM) }
  }

  /** 提交添加：需先选中平台型号 */
  const onCreate = () => {
    if (!picked) { Taro.showToast({ title: '请先搜索并选择轴承型号', icon: 'none' }); return }
    if (submitting) return
    setSubmitting(true)
    createMyBearing({
      bearingId: picked.id,
      priceDescription: form.priceDescription.trim() || undefined,
      stockDescription: form.stockDescription.trim() || undefined,
      minOrderDescription: form.minOrderDescription.trim() || undefined,
      remarks: form.remarks.trim() || undefined
    })
      .then((r) => {
        Taro.showToast({ title: r?.message || '添加成功，等待审核', icon: 'none' })
        setAdding(false); setSearchKw(''); setSearchList([]); setPicked(null); setForm(EMPTY_FORM)
        load(1, false)
      })
      .catch((e: any) => Taro.showToast({ title: e?.message || '添加失败', icon: 'none' }))
      .finally(() => setSubmitting(false))
  }

  /** 进入编辑：回填四项描述 */
  const startEdit = (item: MerchantBearingItem) => {
    setAdding(false)
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
        Taro.showToast({ title: r?.message || '更新成功，等待审核', icon: 'none' })
        setEditingId(null); setForm(EMPTY_FORM)
        load(1, false)
      })
      .catch((e: any) => Taro.showToast({ title: e?.message || '更新失败', icon: 'none' }))
      .finally(() => setSubmitting(false))
  }

  /** 表单四项描述输入行（添加/编辑共用） */
  const descRow = (label: string, key: keyof FormState, placeholder: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 8, paddingBottom: 8 }}>
      <Text style={{ ...fs(13), color: t.textSecondary, width: 72 }}>{label}</Text>
      <Input
        style={{ ...fs(14), color: t.textPrimary, flex: 1, backgroundColor: t.bgInput, borderRadius: 8, paddingLeft: 10, paddingRight: 10, paddingTop: 6, paddingBottom: 6 }}
        value={form[key]}
        placeholder={placeholder}
        placeholderClass="auth-ph"
        onInput={(e) => setForm((prev) => ({ ...prev, [key]: e.detail.value }))}
      />
    </View>
  )

  const formActions = (onSubmit: () => void, okLabel: string) => (
    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
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
      style={{ marginRight: 16, paddingBottom: 6, borderBottomWidth: 2, borderBottomColor: filter === key ? t.primary : 'transparent' }}
      onClick={() => switchFilter(key)}
    >
      <Text style={{ ...fs(14), color: filter === key ? t.primary : t.textSecondary, fontWeight: filter === key ? '600' : '400' }}>{label}</Text>
    </View>
  )

  return (
    <PageLayout nav={<NavBar title="商品管理" showBack />}>
      {/* 操作栏：添加商品（成员均可）+ Excel 导入（仅管理员）——v1.7.3 替代原整行大按钮 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 14, paddingRight: 14, paddingTop: 12, paddingBottom: 4 }}>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.primary, borderRadius: 18, paddingLeft: 14, paddingRight: 14, paddingTop: 7, paddingBottom: 7 }}
          onClick={toggleAdd}
        >
          <Icon name="plus" size={14} color={t.textOnPrimary} />
          <Text style={{ ...fs(13), color: t.textOnPrimary, marginLeft: 4 }}>添加商品</Text>
        </View>
        {isAdmin && (
          <View
            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.bgInput, borderRadius: 18, paddingLeft: 14, paddingRight: 14, paddingTop: 7, paddingBottom: 7, marginLeft: 10 }}
            onClick={onImport}
          >
            <Text style={{ ...fs(13), color: importing ? t.textTertiary : t.primary }}>{importing ? '导入中…' : 'Excel 导入'}</Text>
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
            placeholderClass="auth-ph"
            onInput={(e) => onSearchInput(e.detail.value)}
          />
          {picked && (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, backgroundColor: t.bgInput, borderRadius: 8, paddingLeft: 10, paddingRight: 10, paddingTop: 8, paddingBottom: 8 }}>
              <Text style={{ ...fs(13), color: t.primary, flex: 1 }} numberOfLines={1}>
                已选：{picked.brandName ? `${picked.brandName} ` : ''}{picked.partNumber}{picked.bearingType ? ` · ${picked.bearingType}` : ''}
              </Text>
              <Text style={{ ...fs(13), color: t.textTertiary }} onClick={() => { setPicked(null); setSearchList([]) }}>重选</Text>
            </View>
          )}
          {!picked && searchList.length > 0 && (
            <ScrollView scrollY style={{ maxHeight: 180, marginTop: 8 }} {...({ showsVerticalScrollIndicator: false } as any)}>
              {searchList.map((b) => (
                <View
                  key={b.id}
                  style={{ borderBottomWidth: 1, borderBottomColor: t.border, paddingTop: 8, paddingBottom: 8 }}
                  onClick={() => { setPicked(b); setSearchList([]); setSearchKw(b.partNumber) }}
                >
                  <Text style={{ ...fs(14), color: t.textPrimary }}>{b.partNumber}</Text>
                  <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 2 }}>
                    {[b.brandName, b.bearingType, `${b.innerDiameter}×${b.outerDiameter}×${b.width}`].filter(Boolean).join(' · ') || '—'}
                  </Text>
                </View>
              ))}
            </ScrollView>
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
          {formActions(onCreate, '提交添加')}
        </View>
      )}

      {/* 筛选页签 */}
      <View style={{ flexDirection: 'row', paddingLeft: 14, paddingRight: 14, paddingTop: 10, paddingBottom: 2 }}>
        {filterTab('all', '全部')}
        {filterTab('onSale', '在售')}
        {filterTab('pending', '审核中')}
      </View>

      <View style={{ paddingLeft: 14, paddingRight: 14, marginTop: 8 }}>
        {items.length === 0 && !loading ? (
          <View style={{ alignItems: 'center', paddingTop: 50 }}>
            <Icon name="box" size={40} color={t.textTertiary} />
            <Text style={{ ...fs(14), color: t.textTertiary, marginTop: 12 }}>暂无商品，点左上"添加商品"上架</Text>
          </View>
        ) : (
          <View style={{ borderRadius: 12, overflow: 'hidden' }}>
            {items.map((item) => (
              <View
                key={item.id}
                style={{ backgroundColor: t.bgCard, padding: 12, borderBottomWidth: 1, borderBottomColor: t.border, opacity: busyId === item.id ? 0.5 : 1 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ ...fs(15), color: t.textPrimary, flex: 1 }} numberOfLines={1}>{item.bearingPartNumber}</Text>
                  {item.isPendingApproval && (
                    <View style={{ borderRadius: 4, backgroundColor: '#F59E0B', paddingLeft: 6, paddingRight: 6, paddingTop: 1, paddingBottom: 1, marginRight: 8 }}>
                      <Text style={{ ...fs(10), color: '#fff' }}>审核中</Text>
                    </View>
                  )}
                  <View style={{ width: 52, height: 20, borderRadius: 10, backgroundColor: item.isOnSale ? '#16A34A' : t.textTertiary, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ ...fs(11), color: '#fff' }}>{item.isOnSale ? '在售' : '下架'}</Text>
                  </View>
                </View>
                <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 4 }}>
                  {[item.brandName, item.bearingTypeName, item.priceDescription || item.price].filter(Boolean).join(' · ') || '暂无规格'}
                </Text>
                {/* 行操作：编辑 + 上/下架 */}
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
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
                    <Text style={{ ...fs(12), color: t.primary }}>{item.isOnSale ? '下架' : '上架'}</Text>
                  </View>
                </View>
                {/* 编辑表单（行内展开） */}
                {editingId === item.id && (
                  <View style={{ marginTop: 8, backgroundColor: t.bgInput, borderRadius: 10, padding: 10 }}>
                    {descRow('价格', 'priceDescription', '如：28元/个，量大优惠')}
                    {descRow('库存', 'stockDescription', '如：现货 500 个')}
                    {descRow('起订量', 'minOrderDescription', '如：10 个起订')}
                    {descRow('备注', 'remarks', '选填')}
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
          style={{ alignItems: 'center', paddingTop: 14, paddingBottom: 20 }}
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
