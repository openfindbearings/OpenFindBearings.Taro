// 提名管理员页（入驻模式 B 发起侧）
// 员工发起：填被提名人手机号 + 商户草稿信息 → 后端建 Draft 商户 + Nomination 邀请
// 被提名人（同手机号注册用户）在"待接受的提名"中接受并补资料，审核通过后双方才生效
import { useState } from 'react'
import { View, Text, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import { nominateMerchant } from '../../services/merchant'

const MERCHANT_TYPES = [
  { value: 0, label: '生产厂家' },
  { value: 1, label: '授权经销商' },
  { value: 2, label: '分销商' },
  { value: 3, label: '贸易商' }
]

/** 表单输入行（受控） */
function Field({ label, value, onChange, placeholder, type }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: 'text' | 'number'
}) {
  const t = useTheme()
  const fs = useFs()
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ ...fs(13), color: t.textSecondary, marginBottom: 4 }}>{label}</Text>
      <Input
        style={{ backgroundColor: t.bgInput, borderRadius: 8, padding: 10, fontSize: 15, color: t.textPrimary }}
        value={value}
        type={type || 'text'}
        placeholder={placeholder}
        placeholderStyle={`color:${t.textTertiary}`}
        onInput={(e) => onChange(e.detail.value)}
      />
    </View>
  )
}

export default function MerchantNominatePage() {
  const t = useTheme()
  const fs = useFs()
  const [submitting, setSubmitting] = useState(false)

  const [nomineePhone, setNomineePhone] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState(3)
  const [companyName, setCompanyName] = useState('')
  const [address, setAddress] = useState('')
  const [initiatorJoins, setInitiatorJoins] = useState(true)

  const onTypeSelect = () => {
    Taro.showActionSheet({ itemList: MERCHANT_TYPES.map((x) => x.label) })
      .then((res) => setType(MERCHANT_TYPES[res.tapIndex].value))
      .catch(() => { /* 取消 */ })
  }

  const onSubmit = async () => {
    if (submitting) return
    if (!/^1\d{10}$/.test(nomineePhone)) {
      Taro.showToast({ title: '请填写正确的被提名人手机号', icon: 'none' })
      return
    }
    if (!name.trim()) {
      Taro.showToast({ title: '请填写商户名称', icon: 'none' })
      return
    }
    setSubmitting(true)
    try {
      await nominateMerchant({
        nomineePhone,
        name: name.trim(),
        type,
        companyName: companyName.trim() || undefined,
        address: address.trim() || undefined,
        initiatorJoins
      })
      Taro.showModal({
        title: '提名已发起',
        content: '已通知被提名人。对方接受并补全资料后，将进入平台审核；审核通过后您将成为该商户员工。',
        showCancel: false
      }).then(() => Taro.navigateBack()).catch(() => Taro.navigateBack())
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '提名失败，请稍后重试', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageLayout nav={<NavBar title="提名管理员" showBack />}>
      <View style={{ padding: 14 }}>
        <Text style={{ ...fs(13), color: t.textTertiary, marginBottom: 12 }}>
          您将以员工身份发起，邀请另一手机号注册人成为商户管理员；对方接受并入驻成功后，双方关系才生效。
        </Text>
        <Field label="被提名人手机号 *" value={nomineePhone} onChange={setNomineePhone} placeholder="对方需已用该手机号注册" type="number" />
        <Field label="商户名称 *" value={name} onChange={setName} placeholder="例如：XX轴承经营部" />
        <View style={{ marginBottom: 12 }}>
          <Text style={{ ...fs(13), color: t.textSecondary, marginBottom: 4 }}>商家类型</Text>
          <View style={{ backgroundColor: t.bgInput, borderRadius: 8, padding: 10, flexDirection: 'row', justifyContent: 'space-between' }} onClick={onTypeSelect}>
            <Text style={{ fontSize: 15, color: t.textPrimary }}>{MERCHANT_TYPES.find((x) => x.value === type)?.label}</Text>
            <Text style={{ color: t.textTertiary }}>选择</Text>
          </View>
        </View>
        <Field label="公司全称" value={companyName} onChange={setCompanyName} placeholder="选填，可后续补全" />
        <Field label="经营地址" value={address} onChange={setAddress} placeholder="选填" />
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }} onClick={() => setInitiatorJoins(!initiatorJoins)}>
          <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: initiatorJoins ? t.primary : t.border, backgroundColor: initiatorJoins ? t.primary : 'transparent', marginRight: 8 }} />
          <Text style={{ ...fs(14), color: t.textPrimary }}>审核通过后我作为员工加入该商户</Text>
        </View>
        <View
          style={{ backgroundColor: submitting ? t.textTertiary : t.primary, borderRadius: 24, paddingTop: 12, paddingBottom: 12, alignItems: 'center' }}
          onClick={submitting ? undefined : onSubmit}
        >
          <Text style={{ ...fs(16), color: t.textOnPrimary }}>{submitting ? '提交中…' : '发起提名'}</Text>
        </View>
      </View>
    </PageLayout>
  )
}
