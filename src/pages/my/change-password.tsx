// 设置/修改登录密码页（RN 优先）
// 改动说明（短信登录上线）：验证码登录注册的账号没有密码，在此首次设置；
// 已设密码的老账号修改时须填当前密码。请求走 BFF /mobile/profile/change-password 代理 Identity。
import { useState } from 'react'
import { View, Text, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import Icon from '../../components/Icon'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import { changePassword } from '../../services/user'
// 样式复用登录页 auth.scss（auth-field/auth-input/auth-ph 同一套表单视觉）
import '../auth/auth.scss'

// 编译期配置：禁用外层 ScrollView，滚动由 PageLayout 内部统一提供
definePageConfig({ disableScroll: true })

export default function ChangePasswordPage() {
  const t = useTheme()
  const fs = useFs()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)

  /** 提交：客户端先做长度/一致性校验，服务端按"是否已设密码"校验当前密码 */
  const onSave = async () => {
    if (saving) return
    if (next.length < 6) { Taro.showToast({ title: '新密码至少 6 位', icon: 'none' }); return }
    if (next !== confirm) { Taro.showToast({ title: '两次输入的新密码不一致', icon: 'none' }); return }
    setSaving(true)
    try {
      const r = await changePassword(current, next, confirm)
      if (r?.success) {
        Taro.showToast({ title: '密码已设置', icon: 'success' })
        setTimeout(() => Taro.navigateBack(), 600)
      } else {
        Taro.showToast({ title: r?.message || '修改失败，请重试', icon: 'none' })
      }
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '修改失败，请重试', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  /** 单行密码输入：左图标 + 右输入（RN 安全样式） */
  const pwdField = (
    icon: string,
    placeholder: string,
    value: string,
    onChange: (v: string) => void
  ) => (
    <View
      className='auth-field'
      style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', height: 48, paddingLeft: 12, paddingRight: 12, marginBottom: 14, borderRadius: 10, backgroundColor: t.bgInput, borderWidth: 1, borderStyle: 'solid', borderColor: t.border }}
    >
      <Icon name={icon} size={18} color={t.textTertiary} />
      {/* className 复用 auth-input：H5 端它把内部 .weui-input 拉满宿主高度（输入偏上修复） */}
      <Input
        className='auth-input'
        style={{ ...fs(15), color: t.textPrimary }}
        password
        placeholder={placeholder}
        placeholderClass='auth-ph'
        placeholderTextColor={t.textTertiary}
        value={value}
        onInput={(e) => onChange(e.detail.value)}
      />
    </View>
  )

  return (
    <PageLayout nav={<NavBar title='设置密码' showBack />}>
      <View style={{ padding: 16 }}>
        <Text style={{ ...fs(20), color: t.textPrimary }}>设置登录密码</Text>
        <Text style={{ ...fs(13), color: t.textSecondary, marginTop: 6, marginBottom: 20 }}>
          已设置过密码的账号修改时需填写当前密码
        </Text>

        {pwdField('lock', '当前密码（首次设置可留空）', current, setCurrent)}
        {pwdField('key', '新密码（至少 6 位）', next, setNext)}
        {pwdField('key', '确认新密码', confirm, setConfirm)}

        <View
          style={{ backgroundColor: saving ? t.textTertiary : t.primary, borderRadius: 24, paddingTop: 12, paddingBottom: 12, display: 'flex', alignItems: 'center', marginTop: 8 }}
          onClick={saving ? undefined : onSave}
        >
          <Text style={{ ...fs(16), color: t.textOnPrimary }}>{saving ? '提交中…' : '保存'}</Text>
        </View>

        <Text style={{ ...fs(12), color: t.textTertiary, textAlign: 'center', marginTop: 12 }}>
          设置后可用手机号 + 密码登录
        </Text>
      </View>
    </PageLayout>
  )
}
