// 商户信息维护页（商户管理员专属）：编辑当前商户上下文的资料 + Logo。
// 读 GET /mobile/merchant/profile 回填，写 PUT /mobile/merchant/profile（后端 null=保留），
// Logo 走 POST /mobile/merchant/logo 仅回 URL，随保存写库；均经 X-Merchant-Id 当前商户上下文定位。
import { useState } from 'react'
import { View, Text, Input, Image } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import Icon from '../../components/Icon'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import { getMerchantProfile, updateMerchantProfile, uploadMerchantLogo, type MerchantProfile } from '../../services/merchant'
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

  const setField = (k: keyof typeof form, v: string | number) => setForm((prev) => ({ ...prev, [k]: v }))

  /** 首次显示拉取当前商户资料回填（走 X-Merchant-Id 上下文） */
  useDidShow(() => {
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

  /** 商家类型选择（ActionSheet） */
  const pickType = () => {
    Taro.showActionSheet({ itemList: MERCHANT_TYPES.map((x) => x.label) })
      .then((res) => {
        const item = MERCHANT_TYPES[res.tapIndex]
        if (item) setField('type', item.value)
      })
      .catch(() => { /* 用户取消 */ })
  }

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
        type: form.type || undefined,
        companyName: form.companyName.trim() || undefined,
        unifiedSocialCreditCode: form.unifiedSocialCreditCode.trim() || undefined,
        contactPerson: form.contactPerson.trim() || undefined,
        phone: form.phone.trim() || undefined,
        mobile: form.mobile.trim() || undefined,
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        website: form.website.trim() || undefined,
        description: form.description.trim() || undefined,
        // 改动说明：logoUrl 有值才提交（后端 null=保留），支持上传后落库
        logoUrl: form.logoUrl.trim() || undefined
      })
      if (r?.success) {
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
      {/* Logo 预览：点击上传，仅绝对/相对可解析地址渲染，失败回退 store 图标 */}
      <View style={{ alignItems: 'center', paddingTop: 20, paddingBottom: 20, backgroundColor: t.bgCard, marginBottom: 12 }}>
        <View
          style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: t.bgInput, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
          onClick={uploading ? undefined : onPickLogo}
        >
          {logoSrc
            ? <Image style={{ width: 72, height: 72 }} src={logoSrc} mode="aspectFill" onError={() => setLogoFailed(true)} />
            : <Icon name="store" size={36} color={t.textTertiary} />}
        </View>
        <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 8 }}>{uploading ? '上传中…' : '点击上传商户 Logo'}</Text>
      </View>

      <View style={{ marginBottom: 12 }}>
        {fieldRow('商户名称', <Input style={inputStyle} value={form.name} maxlength={50} placeholder="对外展示名称" placeholderClass="auth-ph" onInput={(e) => setField('name', e.detail.value)} />)}
        {fieldRow('商家类型', (
          <View style={{ flexDirection: 'row', alignItems: 'center' }} onClick={pickType}>
            <Text style={{ ...fs(15), color: form.type ? t.textPrimary : t.textTertiary }}>
              {MERCHANT_TYPES.find((x) => x.value === form.type)?.label || '请选择'}
            </Text>
            <Icon name="chevron-right" size={16} color={t.textTertiary} />
          </View>
        ))}
        {fieldRow('企业名称', <Input style={inputStyle} value={form.companyName} maxlength={100} placeholder="营业执照企业名称" placeholderClass="auth-ph" onInput={(e) => setField('companyName', e.detail.value)} />)}
        {fieldRow('信用代码', <Input style={inputStyle} value={form.unifiedSocialCreditCode} maxlength={18} placeholder="18位统一社会信用代码" placeholderClass="auth-ph" onInput={(e) => setField('unifiedSocialCreditCode', e.detail.value)} />)}
        {fieldRow('联系人', <Input style={inputStyle} value={form.contactPerson} maxlength={30} placeholder="负责人姓名" placeholderClass="auth-ph" onInput={(e) => setField('contactPerson', e.detail.value)} />)}
        {fieldRow('联系电话', <Input style={inputStyle} value={form.phone} maxlength={20} placeholder="手机或座机" placeholderClass="auth-ph" onInput={(e) => setField('phone', e.detail.value)} />)}
        {fieldRow('手机号', <Input style={inputStyle} value={form.mobile} maxlength={20} placeholder="选填" placeholderClass="auth-ph" onInput={(e) => setField('mobile', e.detail.value)} />)}
        {fieldRow('邮箱', <Input style={inputStyle} value={form.email} maxlength={50} placeholder="选填" placeholderClass="auth-ph" onInput={(e) => setField('email', e.detail.value)} />)}
        {fieldRow('经营地址', <Input style={inputStyle} value={form.address} maxlength={100} placeholder="选填" placeholderClass="auth-ph" onInput={(e) => setField('address', e.detail.value)} />)}
        {fieldRow('官网', <Input style={inputStyle} value={form.website} maxlength={100} placeholder="选填" placeholderClass="auth-ph" onInput={(e) => setField('website', e.detail.value)} />)}
        {fieldRow('商家简介', <Input style={inputStyle} value={form.description} maxlength={200} placeholder="一句话介绍" placeholderClass="auth-ph" onInput={(e) => setField('description', e.detail.value)} />)}
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
