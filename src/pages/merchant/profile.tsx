// 商户信息维护页（商户管理员专属）：编辑当前商户上下文的资料 + Logo。
// 读 GET /mobile/merchant/profile 回填，写 PUT /mobile/merchant/profile（后端 null=保留），
// Logo 走 POST /mobile/merchant/logo 仅回 URL，随保存写库；均经 X-Merchant-Id 当前商户上下文定位。
import { useState } from 'react'
import { View, Text, Input, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { vibrateSuccess } from '../../utils/haptics'
import Icon from '../../components/Icon'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import { getMerchantProfile, updateMerchantProfile, uploadMerchantLogo, getMyDocuments, submitDocument, type MerchantProfile, type MerchantDocumentItem } from '../../services/merchant'
import { useMerchantStore } from '../../stores/merchant'
import { usableImage } from '../../services/config'

definePageConfig({ disableScroll: true })

/** 商家类型（对齐后端 MerchantType 枚举 value/名称/中文） */
const MERCHANT_TYPES = [
  { value: 1, label: '生产厂家', name: 'Manufacturer' },
  { value: 2, label: '授权经销商', name: 'AuthorizedDealer' },
  { value: 3, label: '分销商', name: 'Distributor' },
  { value: 4, label: '贸易商', name: 'Trader' }
]

/** 把后端返回的类型（枚举名/中文/数字串）统一解析为枚举 value，无法识别返回 0 */
function resolveType(t?: string | null): number {
  if (!t) return 0
  const hit = MERCHANT_TYPES.find((x) => x.name === t || x.label === t || String(x.value) === t)
  return hit?.value ?? 0
}

/** 表单初值 */
const EMPTY = {
  name: '', type: 0, companyName: '', unifiedSocialCreditCode: '',
  contactPerson: '', phone: '', mobile: '', email: '', address: '',
  website: '', description: '', logoUrl: ''
}

/** 证照材料槽位定义（对齐后端 DocumentType：1 执照 / 2 授权书 / 3 厂房照，v1.7.0 新增） */
const DOC_SLOTS = [
  { type: 1, label: '营业执照' },
  { type: 2, label: '品牌授权书' },
  { type: 3, label: '厂房照片' }
]

/** 材料审核状态中文与色调映射（与 API DocumentStatus 对齐） */
const DOC_STATUS_MAP: Record<string, { label: string; color: 'primary' | 'success' | 'danger' }> = {
  Pending: { label: '审核中', color: 'primary' },
  Approved: { label: '已通过', color: 'success' },
  Rejected: { label: '已驳回', color: 'danger' }
}

/** 商户信息维护页：载入当前商户资料，逐项可编辑后保存 */
export default function MerchantProfilePage() {
  const t = useTheme()
  const fs = useFs()

  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  // logo 加载失败回退占位图标
  const [logoFailed, setLogoFailed] = useState(false)
  // 改动说明（v1.7.0）：证照材料区——当前商户各槽位最新一条材料 + 上传中槽位
  const [docs, setDocs] = useState<MerchantDocumentItem[]>([])
  const [docUploading, setDocUploading] = useState<number | null>(null)

  /** 拉取当前商户证照材料列表（X-Merchant-Id 上下文） */
  const loadDocs = () => {
    getMyDocuments().then((r) => setDocs(r ?? [])).catch(() => { /* 未选商户或网络异常时留空 */ })
  }

  const setField = (k: keyof typeof form, v: string | number) => setForm((prev) => ({ ...prev, [k]: v }))

  /** 首次显示拉取当前商户资料回填（走 X-Merchant-Id 上下文） */
  useDidShow(() => {
    // 改动说明（v1.7.0）：材料列表每次回页刷新（审核状态由平台变更，需最新视图）
    loadDocs()
    if (loaded) return
    getMerchantProfile()
      .then((p: MerchantProfile) => {
        if (!p) return
        setForm({
          name: p.name || '',
          type: resolveType(p.type),
          companyName: p.companyName || '',
          unifiedSocialCreditCode: p.unifiedSocialCreditCode || '',
          contactPerson: p.contactPerson || '',
          phone: p.phone || '',
          mobile: p.mobile || '',
          email: p.email || '',
          address: p.address || '',
          website: p.website || '',
          description: p.description || '',
          logoUrl: p.logoUrl || ''
        })
        setLoaded(true)
      })
      .catch(() => { /* 拉取失败保持空表单，仍可编辑提交 */ })
  })

  /** 选图并上传 Logo，成功回填表单 logoUrl（保存时统一落库） */
  const onPickLogo = () => {
    setUploading(true)
    uploadMerchantLogo()
      .then((r) => {
        if (r?.success && r.url) {
          setField('logoUrl', r.url)
          setLogoFailed(false)
          Taro.showToast({ title: 'Logo 已选择，保存后生效', icon: 'none' })
        } else {
          Taro.showToast({ title: r?.message || '上传失败', icon: 'none' })
        }
      })
      .catch(() => Taro.showToast({ title: '上传失败', icon: 'none' }))
      .finally(() => setUploading(false))
  }

  /** 按类型选图提交证照材料（入驻后即时建待审记录，成功后刷新槽位状态，v1.7.0 新增） */
  const onPickDoc = (tp: number) => {
    if (docUploading) return
    setDocUploading(tp)
    submitDocument(tp)
      .then((r) => {
        Taro.showToast({ title: r?.message || (r?.success ? '材料已提交' : '提交失败'), icon: 'none' })
        if (r?.success) loadDocs()
      })
      .catch(() => Taro.showToast({ title: '上传失败', icon: 'none' }))
      .finally(() => setDocUploading(null))
  }

  // 改动说明（v1.7.7）：pickType 已移除——商家类型 Active 后锁定（后端守卫），选择器成死代码

  /** 保存：仅提交非空可编辑字段（后端 null/undefined 保留原值），成功后返回 */
  const onSave = async () => {
    if (saving) return
    if (!form.name.trim()) {
      Taro.showToast({ title: '商户名称不能为空', icon: 'none' })
      return
    }
    setSaving(true)
    try {
      const r = await updateMerchantProfile({
        name: form.name.trim(),
        // 改动说明（v1.7.12）：联系方式/简介/官网等字段直传空串=清除（后端 null=保留、''=写入清除）——
        //   原 `|| undefined` 让爬虫残留值（如邮箱列存着地址）永远删不掉，是死路；现在清空输入框保存即可删
        // 改动说明（v1.7.7）：type 不再回传（商家类型锁定，原回传同值属噪音）
        // 信用代码：仅历史空值时提交补录（非空锁定，后端同口径）
        unifiedSocialCreditCode: form.unifiedSocialCreditCode.trim() || undefined,
        contactPerson: form.contactPerson.trim(),
        phone: form.phone.trim(),
        mobile: form.mobile.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        website: form.website.trim(),
        description: form.description.trim(),
        // 改动说明：logoUrl 有值才提交（后端 null=保留），支持上传后落库
        logoUrl: form.logoUrl.trim() || undefined
      })
      if (r?.success) {
        // 改动说明（v1.7.13）：保存成功触感反馈（应用级震动开关内建）
        void vibrateSuccess()
        // 重拉入驻状态，TabBar/商户页随当前商户资料刷新（logo/名称）
        void useMerchantStore.getState().fetchApplications()
        Taro.showToast({ title: r.message || '资料已更新', icon: 'success' })
        setTimeout(() => Taro.navigateBack(), 700)
      } else {
        Taro.showToast({ title: r?.message || '保存失败', icon: 'none' })
      }
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '保存失败', icon: 'none' })
    } finally { setSaving(false) }
  }

  /** 单行字段：左标题 + 右输入 */
  const fieldRow = (label: string, node: any) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.bgCard, paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: t.border }}>
      <Text style={{ ...fs(15), color: t.textPrimary, width: 88 }}>{label}</Text>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>{node}</View>
    </View>
  )
  const inputStyle = { ...fs(15), color: t.textPrimary, textAlign: 'right' as const, flex: 1 }
  const logoSrc = form.logoUrl && !logoFailed ? usableImage(form.logoUrl) : ''

  return (
    <PageLayout nav={<NavBar title="信息维护" showBack />}>
      {/* Logo 预览：点击上传，仅绝对/相对可解析地址渲染，失败回退 store 图标。
          改动说明（v1.7.12）：72 圆形 aspectFill 会把非方形 logo 裁掉边角——改 96 圆角白底
          aspectFit 完整自适应显示（与商户列表卡 mch-avatar-img 同口径） */}
      <View style={{ alignItems: 'center', paddingTop: 20, paddingBottom: 20, backgroundColor: t.bgCard, marginBottom: 12 }}>
        <View
          style={{ width: 96, height: 96, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: t.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
          onClick={uploading ? undefined : onPickLogo}
        >
          {logoSrc
            ? <Image style={{ width: 96, height: 96 }} src={logoSrc} mode="aspectFit" onError={() => setLogoFailed(true)} />
            : <Icon name="store" size={40} color={t.textTertiary} />}
        </View>
        <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 8 }}>{uploading ? '上传中…' : '点击上传商户 Logo'}</Text>
      </View>

      <View style={{ marginBottom: 12 }}>
        {fieldRow('商户名称', <Input style={inputStyle} value={form.name} maxlength={50} placeholder="对外展示名称" placeholderClass="auth-ph" onInput={(e) => setField('name', e.detail.value)} />)}
        {/* 改动说明（v1.7.7）：商家类型只读——类型决定材料矩阵与认证标准，后端 Active 后锁定，
            自助改类型是假动作（原 UpdateType 未接通）且绕过审核，变更走平台人工 */}
        {fieldRow('商家类型', (
          <Text style={inputStyle}>{MERCHANT_TYPES.find((x) => x.value === form.type)?.label || '-'}</Text>
        ))}
        {/* 改动说明（v1.7.4 字段锁定）：企业名称与执照绑定，入驻生效后只读（后端 UpdateMerchant 同步守卫） */}
        {fieldRow('企业名称', <Text style={inputStyle}>{form.companyName || '-'}</Text>)}
        {/* 改动说明（v1.7.7）：信用代码"空可补录一次、非空锁定"（后端同口径）——
            历史选填时代入驻的商户在此补录，补录后不可再改 */}
        {form.unifiedSocialCreditCode
          ? fieldRow('信用代码', <Text style={inputStyle}>{form.unifiedSocialCreditCode}</Text>)
          : fieldRow('信用代码', <Input style={inputStyle} value={form.unifiedSocialCreditCode} maxlength={18} placeholder="补录18位代码（见营业执照）" placeholderClass="auth-ph" onInput={(e) => setField('unifiedSocialCreditCode', e.detail.value)} />)}
        <View style={{ backgroundColor: t.bgCard, paddingLeft: 16, paddingRight: 16, paddingTop: 8, paddingBottom: 10 }}>
          <Text style={{ ...fs(11), color: t.textTertiary }}>企业主体信息以营业执照为准，入驻后不可自助修改；商家类型决定认证材料标准，如需变更请联系平台。</Text>
        </View>
        {fieldRow('联系人', <Input style={inputStyle} value={form.contactPerson} maxlength={30} placeholder="负责人姓名" placeholderClass="auth-ph" onInput={(e) => setField('contactPerson', e.detail.value)} />)}
        {fieldRow('客服电话', <Input style={inputStyle} value={form.phone} maxlength={20} placeholder="对外公开，可填400/座机/手机" placeholderClass="auth-ph" onInput={(e) => setField('phone', e.detail.value)} />)}
        {fieldRow('手机号', <Input style={inputStyle} value={form.mobile} maxlength={20} placeholder="选填" placeholderClass="auth-ph" onInput={(e) => setField('mobile', e.detail.value)} />)}
        {fieldRow('邮箱', <Input style={inputStyle} value={form.email} maxlength={50} placeholder="选填" placeholderClass="auth-ph" onInput={(e) => setField('email', e.detail.value)} />)}
        {fieldRow('经营地址', <Input style={inputStyle} value={form.address} maxlength={100} placeholder="选填" placeholderClass="auth-ph" onInput={(e) => setField('address', e.detail.value)} />)}
        {fieldRow('官网', <Input style={inputStyle} value={form.website} maxlength={100} placeholder="选填" placeholderClass="auth-ph" onInput={(e) => setField('website', e.detail.value)} />)}
        {fieldRow('商家简介', <Input style={inputStyle} value={form.description} maxlength={200} placeholder="一句话介绍" placeholderClass="auth-ph" onInput={(e) => setField('description', e.detail.value)} />)}
      </View>

      {/* v1.7.0 证照材料区：各槽位最新材料状态 + 补传/换证入口（提交即建待审记录进平台队列） */}
      <View style={{ backgroundColor: t.bgCard, paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 4, marginBottom: 12 }}>
        <Text style={{ ...fs(15), color: t.textPrimary, marginBottom: 4 }}>证照材料</Text>
        {DOC_SLOTS.map((slot) => {
          const latest = docs.filter((x) => x.type === slot.type).slice(-1)[0]
          const st = latest ? DOC_STATUS_MAP[latest.status] : undefined
          const thumb = latest && latest.status !== 'Rejected' ? usableImage(latest.fileUrl) : ''
          return (
            <View key={slot.type} style={{ flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: t.border, paddingTop: 10, paddingBottom: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ ...fs(14), color: t.textPrimary }}>{slot.label}</Text>
                <Text style={{ ...fs(12), color: st ? (t as any)[st.color] : t.textTertiary, marginTop: 2 }}>
                  {st ? `最近提交：${st.label}${latest.reviewComment ? `（${latest.reviewComment}）` : ''}` : '未提交'}
                </Text>
              </View>
              {thumb ? <Image style={{ width: 40, height: 40, borderRadius: 6, marginRight: 10 }} src={thumb} mode="aspectFill" /> : null}
              <Text style={{ ...fs(13), color: docUploading === slot.type ? t.textTertiary : t.primary }} onClick={() => onPickDoc(slot.type)}>
                {docUploading === slot.type ? '上传中…' : latest ? '补传/换证' : '上传'}
              </Text>
            </View>
          )
        })}
      </View>

      <View
        style={{ backgroundColor: saving ? t.textTertiary : t.primary, borderRadius: 24, paddingTop: 12, paddingBottom: 12, alignItems: 'center', marginLeft: 16, marginRight: 16 }}
        onClick={saving ? undefined : onSave}
      >
        <Text style={{ ...fs(16), color: t.textOnPrimary }}>{saving ? '保存中…' : '保存'}</Text>
      </View>
      <Text style={{ ...fs(12), color: t.textTertiary, textAlign: 'center', marginTop: 10 }}>
        仅商户管理员可维护资料；留空字段保存后保持原值不变
      </Text>
    </PageLayout>
  )
}
