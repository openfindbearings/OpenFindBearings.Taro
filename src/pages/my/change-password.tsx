// 改密第一步：验证身份页（RN 优先）
// 改动说明（验证码改密）：改密验证由"验旧密码"改为手机验证码——验证码注册用户多数无密码，
// 忘旧密码时旧方案无路可走。本页发码（type=reset_password）并暂存验证码，跳转设置新密码页。
import { useEffect, useRef, useState } from 'react'
import { View, Text, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import Icon from '../../components/Icon'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import { useAuthStore } from '../../stores/auth'
import { setPendingChangePasswordCode } from '../../services/user'
import { getItem } from '../../utils/storage'
// 样式复用登录页 auth.scss（auth-field/auth-input/auth-ph 同一套表单视觉）
import '../auth/auth.scss'

// 编译期配置：禁用外层 ScrollView，滚动由 PageLayout 内部统一提供
definePageConfig({ disableScroll: true })

/** 验证码重发倒计时秒数（服务端另有 60 秒频控兜底） */
const RESEND_SECONDS = 60

export default function ChangePasswordPage() {
  const t = useTheme()
  const fs = useFs()
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState('')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { user, sendCode } = useAuthStore()

  // 进入页面：取当前账号绑定手机号（store 优先，冷启动兜底读本地持久化）
  useEffect(() => {
    if (user?.phoneNumber) {
      setPhone(user.phoneNumber)
    } else {
      getItem('user_phone').then((p) => { if (p) setPhone(p) }).catch(() => { /* 无记录 */ })
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  /** 手机号脱敏展示：138****1234 */
  const maskedPhone = phone ? `${phone.slice(0, 3)}****${phone.slice(7)}` : '绑定手机号'

  /** 启动 60 秒重发倒计时 */
  const startCountdown = () => {
    setCountdown(RESEND_SECONDS)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  /** 发送改密验证码（type=reset_password，与登录码隔离） */
  const onSendCode = async () => {
    setMsg('')
    if (!phone) { setMsg('账号未绑定手机号，无法验证'); return }
    setSending(true)
    try {
      await sendCode(phone, 'reset_password')
      setCode('')
      startCountdown()
    } catch (e: any) {
      setMsg(e?.message || '验证码发送失败，请稍后再试')
    } finally {
      setSending(false)
    }
  }

  /** 下一步：6 位长度校验后暂存验证码，跳设置新密码页（真校验在保存提交时完成） */
  const onNext = () => {
    setMsg('')
    if (!/^\d{6}$/.test(code)) { setMsg('请输入 6 位验证码'); return }
    setPendingChangePasswordCode(code)
    Taro.navigateTo({ url: '/pages/my/new-password' })
  }

  return (
    <PageLayout nav={<NavBar title='设置密码' showBack />}>
      <View style={{ padding: 16 }}>
        <Text style={{ ...fs(20), color: t.textPrimary }}>验证身份</Text>
        <Text style={{ ...fs(13), color: t.textSecondary, marginTop: 6, marginBottom: 20 }}>
          验证码将发送至 {maskedPhone}
        </Text>

        {/* 验证码输入：左图标 + 输入 + 右侧发送/倒计时（复用登录页表单视觉） */}
        <View
          className='auth-field'
          style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', height: 48, paddingLeft: 12, paddingRight: 12, marginBottom: 14, borderRadius: 10, backgroundColor: t.bgInput, borderWidth: 1, borderStyle: 'solid', borderColor: t.border }}
        >
          <Icon name='shield' size={18} color={t.textTertiary} />
          <Input
            className='auth-input'
            style={{ ...fs(15), color: t.textPrimary }}
            type='number'
            maxlength={6}
            placeholder='请输入6位验证码'
            placeholderClass='auth-ph'
            value={code}
            onInput={(e) => setCode(e.detail.value)}
          />
          <Text
            className='auth-link'
            style={{ ...fs(13), color: countdown > 0 || sending ? t.textTertiary : t.primaryText }}
            onClick={countdown > 0 || sending ? undefined : onSendCode}
          >
            {sending ? '发送中…' : countdown > 0 ? `${countdown}s 后重发` : '发送验证码'}
          </Text>
        </View>

        {!!msg && (
          <Text style={{ ...fs(13), color: t.danger, display: 'block', marginBottom: 8 }}>{msg}</Text>
        )}

        <View
          style={{ backgroundColor: t.primary, borderRadius: 24, paddingTop: 12, paddingBottom: 12, display: 'flex', alignItems: 'center', marginTop: 8 }}
          onClick={onNext}
        >
          <Text style={{ ...fs(16), color: t.textOnPrimary }}>下一步</Text>
        </View>

        <Text style={{ ...fs(12), color: t.textTertiary, textAlign: 'center', marginTop: 12 }}>
          验证通过后设置新密码
        </Text>
      </View>
    </PageLayout>
  )
}
