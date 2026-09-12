// 待我接受的提名页（入驻模式 B 被提名人侧）
// 后端按当前登录用户手机号匹配未过期 Nomination 邀请；用户补全资料并提交后进入平台审核
import { useState } from 'react'
import { View, Text, Input } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import Icon from '../../components/Icon'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import { useMerchantStore } from '../../stores/merchant'
import { getPendingNominations, acceptNomination, type PendingNomination } from '../../services/merchant'

/** 简单输入行 */
function Row({ label, value, onChange, placeholder }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  const t = useTheme()
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ fontSize: 13, color: t.textSecondary, marginBottom: 4 }}>{label}</Text>
      <Input
        style={{ backgroundColor: t.bgInput, borderRadius: 8, padding: 10, fontSize: 15, color: t.textPrimary }}
        value={value}
        placeholder={placeholder}
        placeholderStyle={`color:${t.textTertiary}`}
        onInput={(e) => onChange(e.detail.value)}
      />
    </View>
  )
}

export default function MerchantNominationsPage() {
  const t = useTheme()
  const fs = useFs()
  const fetchApplications = useMerchantStore((s) => s.fetchApplications)

  const [list, setList] = useState<PendingNomination[]>([])
  const [openCode, setOpenCode] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [creditCode, setCreditCode] = useState('')
  const [contactPerson, setContactPerson] = useState('')
  const [mobile, setMobile] = useState('')
  const [address, setAddress] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = () => {
    getPendingNominations()
      .then((r) => setList(r ?? []))
      .catch(() => { /* 拉取失败保持空列表 */ })
  }

  useDidShow(() => {
    load()
  })

  const openAccept = (item: PendingNomination) => {
    setOpenCode(item.invitationCode === openCode ? null : item.invitationCode)
    setCompanyName('')
    setCreditCode('')
    setContactPerson('')
    setMobile('')
    setAddress('')
  }

  const onAccept = async (code: string) => {
    if (submitting) return
    setSubmitting(true)
    try {
      await acceptNomination(code, {
        companyName: companyName.trim() || undefined,
        unifiedSocialCreditCode: creditCode.trim() || undefined,
        contactPerson: contactPerson.trim() || undefined,
        mobile: mobile.trim() || undefined,
        address: address.trim() || undefined
      })
      Taro.showModal({
        title: '已接受提名',
        content: '资料已提交，等待平台审核。审核通过后您将正式成为商户管理员。',
        showCancel: false
      }).then(() => {
        load()
        // 提名发起人在本设备（同一人两账号场景）时刷新其入驻状态
        void fetchApplications()
      }).catch(() => load())
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '提交失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageLayout nav={<NavBar title="待接受的提名" showBack />}>
      <View style={{ padding: 14 }}>
        {list.length === 0 ? (
          <View style={{ alignItems: 'center', paddingTop: 60 }}>
            <Icon name="mail" size={40} color={t.textTertiary} />
            <Text style={{ ...fs(14), color: t.textTertiary, marginTop: 12 }}>暂无待接受的提名邀请</Text>
          </View>
        ) : (
          list.map((item) => {
            const open = item.invitationCode === openCode
            return (
              <View key={item.invitationCode} style={{ backgroundColor: t.bgCard, borderRadius: 12, padding: 14, marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }} onClick={() => openAccept(item)}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ ...fs(15), color: t.textPrimary }}>{item.merchantName}</Text>
                    <Text style={{ ...fs(12), color: t.textTertiary, marginTop: 4 }}>
                      有人邀请您成为该商户的管理员{item.companyName ? `（${item.companyName}）` : ''}
                    </Text>
                  </View>
                  <Text style={{ ...fs(13), color: t.primary }}>{open ? '收起' : '接受并补资料'}</Text>
                </View>

                {open && (
                  <View style={{ marginTop: 14 }}>
                    <Row label="公司全称" value={companyName} onChange={setCompanyName} placeholder="与营业执照一致" />
                    <Row label="统一社会信用代码" value={creditCode} onChange={setCreditCode} placeholder="选填，用于后续认证" />
                    <Row label="联系人" value={contactPerson} onChange={setContactPerson} placeholder="您的姓名" />
                    <Row label="联系电话" value={mobile} onChange={setMobile} placeholder="选填" />
                    <Row label="经营地址" value={address} onChange={setAddress} placeholder="选填" />
                    <View
                      style={{ backgroundColor: submitting ? t.textTertiary : t.primary, borderRadius: 24, paddingTop: 11, paddingBottom: 11, alignItems: 'center', marginTop: 4 }}
                      onClick={submitting ? undefined : () => onAccept(item.invitationCode)}
                    >
                      <Text style={{ ...fs(15), color: t.textOnPrimary }}>{submitting ? '提交中…' : '确认接受并提交审核'}</Text>
                    </View>
                  </View>
                )}
              </View>
            )
          })
        )}
      </View>
    </PageLayout>
  )
}
