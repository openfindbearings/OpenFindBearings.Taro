// 商户入驻申请页
// 支持两种模式：self 自助当管理员（新建商户）/ claim 认领爬虫商家（输入名称搜索可认领项后选中）
// 提交经 BFF /mobile/merchants/apply 到 API，成功后由 Admin 审核（approve 生效、执照认证提升等级）
import { useState } from 'react'
import { View, Text, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import Icon from '../../components/Icon'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import { useAuthStore } from '../../stores/auth'
import { useMerchantStore } from '../../stores/merchant'
import { applyMerchant, searchClaimableMerchants, type ClaimableMerchant } from '../../services/merchant'

/** 商家类型（对齐 API MerchantType：1生产厂家/2授权经销商/3分销商/4贸易商） */
const MERCHANT_TYPES = [
  { value: 1, label: '生产厂家' },
  { value: 2, label: '授权经销商' },
  { value: 3, label: '分销商' },
  { value: 4, label: '贸易商' }
]

export default function MerchantApplyPage() {
  const t = useTheme()
  const fs = useFs()
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const fetchApplications = useMerchantStore((s) => s.fetchApplications)

  // 模式：self 新建 / claim 认领
  const [mode, setMode] = useState<'self' | 'claim'>('self')
  const [form, setForm] = useState({
    name: '', companyName: '', type: 0, contactPerson: '',
    phone: '', address: '', unifiedSocialCreditCode: '', description: ''
  })
  // 认领搜索
  const [keyword, setKeyword] = useState('')
  const [claimResults, setClaimResults] = useState<ClaimableMerchant[]>([])
  const [claimSelected, setClaimSelected] = useState<ClaimableMerchant | null>(null)
  const [searching, setSearching] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const setField = (k: keyof typeof form, v: string | number) => setForm((prev) => ({ ...prev, [k]: v }))

  /** 选择商家类型（ActionSheet） */
  const pickType = () => {
    Taro.showActionSheet({ itemList: MERCHANT_TYPES.map((x) => x.label) })
      .then((res) => {
        const item = MERCHANT_TYPES[res.tapIndex]
        if (item) setField('type', item.value)
      })
      .catch(() => { /* 用户取消 */ })
  }

  /** 认领搜索（输入名称联想） */
  const onSearchClaim = async () => {
    if (!keyword.trim()) return
    setSearching(true)
    try {
      const r = await searchClaimableMerchants({ keyword: keyword.trim(), pageSize: 20 })
      setClaimResults(r?.items ?? [])
      setClaimSelected(null)
    } catch {
      Taro.showToast({ title: '搜索失败', icon: 'none' })
    } finally { setSearching(false) }
  }

  /** 提交申请 */
  const onSubmit = async () => {
    if (submitting) return
    if (!isLoggedIn) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      return
    }

    let body: any
    if (mode === 'claim') {
      if (!claimSelected) {
        Taro.showToast({ title: '请选择要认领的商家', icon: 'none' })
        return
      }
      body = { mode: 'claim', claimMerchantId: claimSelected.id }
    } else {
      if (!form.name.trim()) {
        Taro.showToast({ title: '请填写商家名称', icon: 'none' })
        return
      }
      body = {
        mode: 'self',
        name: form.name.trim(),
        type: form.type || undefined,
        contactPerson: form.contactPerson.trim() || undefined,
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        companyName: form.companyName.trim() || undefined,
        unifiedSocialCreditCode: form.unifiedSocialCreditCode.trim() || undefined,
        description: form.description.trim() || undefined
      }
    }

    setSubmitting(true)
    try {
      const r = await applyMerchant(body)
      Taro.showToast({ title: r?.message || '申请已提交，等待审核', icon: 'success' })
      // 提交后刷新入驻状态
      void fetchApplications()
      setTimeout(() => Taro.navigateBack(), 800)
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '提交失败', icon: 'none' })
    } finally { setSubmitting(false) }
  }

  const fieldRow = (label: string, node: any) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.bgCard, paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: t.border }}>
      <Text style={{ ...fs(15), color: t.textPrimary, width: 92 }}>{label}</Text>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>{node}</View>
    </View>
  )
  const inputStyle = { ...fs(15), color: t.textPrimary, textAlign: 'right' as const, flex: 1 }

  // 模式切换卡片
  const modeCard = (m: 'self' | 'claim', icon: string, title: string, desc: string) => (
    <View
      style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: mode === m ? t.primaryLight : t.bgCard, borderWidth: 1, borderColor: mode === m ? t.primary : t.border, alignItems: 'center' }}
      onClick={() => { setMode(m); setClaimResults([]); setClaimSelected(null) }}
    >
      <Icon name={icon} size={22} color={mode === m ? t.primary : t.textTertiary} />
      <Text style={{ ...fs(14), color: t.textPrimary, marginTop: 8 }}>{title}</Text>
      <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 4, textAlign: 'center' }}>{desc}</Text>
    </View>
  )

  return (
    <PageLayout nav={<NavBar title="商家入驻" showBack />}>
      <View style={{ padding: 16 }}>
        {/* 模式选择 */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
          {modeCard('self', 'store', '自助入驻', '新建商户，自己当管理员')}
          {modeCard('claim', 'search', '认领商家', '认领已有爬虫商户')}
        </View>

        {mode === 'self' ? (
          <View>
            <View style={{ borderRadius: 12, overflow: 'hidden' }}>
              {fieldRow('商家名称', <Input style={inputStyle} value={form.name} maxlength={50} placeholder="必填" placeholderClass="auth-ph" onInput={(e) => setField('name', e.detail.value)} />)}
              {fieldRow('商家类型', (
                <View style={{ flexDirection: 'row', alignItems: 'center' }} onClick={pickType}>
                  <Text style={{ ...fs(15), color: form.type ? t.textPrimary : t.textTertiary }}>
                    {MERCHANT_TYPES.find((x) => x.value === form.type)?.label || '请选择'}
                  </Text>
                  <Icon name="chevron-right" size={16} color={t.textTertiary} />
                </View>
              ))}
              {fieldRow('公司全称', <Input style={inputStyle} value={form.companyName} maxlength={100} placeholder="选填" placeholderClass="auth-ph" onInput={(e) => setField('companyName', e.detail.value)} />)}
              {fieldRow('统一信用代码', <Input style={inputStyle} value={form.unifiedSocialCreditCode} maxlength={30} placeholder="选填" placeholderClass="auth-ph" onInput={(e) => setField('unifiedSocialCreditCode', e.detail.value)} />)}
              {fieldRow('联系人', <Input style={inputStyle} value={form.contactPerson} maxlength={30} placeholder="选填" placeholderClass="auth-ph" onInput={(e) => setField('contactPerson', e.detail.value)} />)}
              {fieldRow('联系电话', <Input style={inputStyle} value={form.phone} maxlength={20} placeholder="选填" placeholderClass="auth-ph" onInput={(e) => setField('phone', e.detail.value)} />)}
              {fieldRow('地址', <Input style={inputStyle} value={form.address} maxlength={100} placeholder="选填" placeholderClass="auth-ph" onInput={(e) => setField('address', e.detail.value)} />)}
              {fieldRow('简介', <Input style={inputStyle} value={form.description} maxlength={200} placeholder="选填" placeholderClass="auth-ph" onInput={(e) => setField('description', e.detail.value)} />)}
            </View>
          </View>
        ) : (
          <View style={{ borderRadius: 12, backgroundColor: t.bgCard, padding: 14 }}>
            <Text style={{ ...fs(13), color: t.textSecondary, marginBottom: 10 }}>
              输入商家名称搜索可认领的爬虫商户（已认领的不会被列出）
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Input
                style={{ ...fs(15), color: t.textPrimary, backgroundColor: t.bgInput, borderRadius: 8, paddingLeft: 10, paddingRight: 10, height: 40, flex: 1 }}
                value={keyword}
                placeholder="输入名称搜索"
                placeholderClass="auth-ph"
                onInput={(e) => setKeyword(e.detail.value)}
                confirmType="search"
                onConfirm={onSearchClaim}
              />
              <View style={{ backgroundColor: searching ? t.textTertiary : t.primary, borderRadius: 8, paddingLeft: 16, paddingRight: 16, justifyContent: 'center' }} onClick={searching ? undefined : onSearchClaim}>
                <Text style={{ ...fs(14), color: t.textOnPrimary }}>搜索</Text>
              </View>
            </View>

            {claimResults.length > 0 && (
              <View style={{ marginTop: 12 }}>
                {claimResults.map((item) => {
                  const selected = claimSelected?.id === item.id
                  return (
                    <View
                      key={item.id}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 10, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: t.border }}
                      onClick={() => setClaimSelected(item)}
                    >
                      <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: selected ? t.primary : t.textTertiary, marginRight: 10, alignItems: 'center', justifyContent: 'center' }}>
                        {selected && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.primary }} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ ...fs(15), color: t.textPrimary }}>{item.name}</Text>
                        {item.companyName ? <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 2 }}>{item.companyName}</Text> : null}
                      </View>
                      <Text style={{ ...fs(12), color: t.textTertiary }}>{item.type}</Text>
                    </View>
                  )
                })}
              </View>
            )}
          </View>
        )}

        {/* 提交按钮 */}
        <View
          style={{ backgroundColor: submitting ? t.textTertiary : t.primary, borderRadius: 24, paddingTop: 12, paddingBottom: 12, alignItems: 'center', marginTop: 18 }}
          onClick={submitting ? undefined : onSubmit}
        >
          <Text style={{ ...fs(16), color: t.textOnPrimary }}>{submitting ? '提交中…' : '提交入驻申请'}</Text>
        </View>
        <Text style={{ ...fs(12), color: t.textTertiary, textAlign: 'center', marginTop: 10 }}>
          提交后由平台审核，通过后商户生效；营业执照可在入驻后于店铺认证中补传
        </Text>
      </View>
    </PageLayout>
  )
}
