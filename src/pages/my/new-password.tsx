// 改密第二步：设置新密码页（RN 优先）
// 改动说明（验证码改密）：与验证码页拆成两个独立页面；保存时取回内存中暂存的验证码，
// 与新密码一次提交（Identity 端完成"验码+改密"，不加新接口）。
import { useState } from 'react'
import { View, Text, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import Icon from '../../components/Icon'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import { changePassword, takePendingChangePasswordCode } from '../../services/user'
// 样式复用登录页 auth.scss（auth-field/auth-input/auth-ph 同一套表单视觉）
import '../auth/auth.scss'

// 编译期配置：禁用外层 ScrollView，滚动由 PageLayout 内部统一提供
definePageConfig({ disableScroll: true })

export default function NewPasswordPage() {
  const t = useTheme()
  const fs = useFs()
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)

  /** 提交：客户端先做长度/一致性校验，服务端以暂存验证码完成身份验证并改密 */
  const onSave = async () => {
    if (saving) return
    const code = takePendingChangePasswordCode()
    if (!code) {
      // 验证码暂存已失效（中途杀进程/重复进入），回验证码页重走流程
      Taro.showToast({ title: '验证码已失效，请重新验证', icon: 'none' })
      setTimeout(() => Taro.navigateBack(), 800)
      return
    }
    if (next.length < 6) { Taro.showToast({ title: '新密码至少 6 位', icon: 'none' }); return }
    if (next !== confirm) { Taro.showToast({ title: '两次输入的新密码不一致', icon: 'none' }); return }
    setSaving(true)
    try {
      const r = await changePassword(code, next, confirm)
      if (r?.success) {
        Taro.showToast({ title: '密码已设置', icon: 'success' })
        // 连退两页（新密码页 → 验证码页）回个人资料入口
        setTimeout(() => Taro.navigateBack({ delta: 2 }), 600)
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
    <PageLayout nav={<NavBar title='设置新密码' showBack />}>
      <View style={{ padding: 16 }}>
        <Text style={{ ...fs(20), color: t.textPrimary }}>设置新密码</Text>
        <Text style={{ ...fs(13), color: t.textSecondary, marginTop: 6, marginBottom: 20 }}>
          手机号验证已通过，请设置新的登录密码
        </Text>

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
