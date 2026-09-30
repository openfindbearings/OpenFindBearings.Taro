// 登录页（RN 优先：仅 Taro 跨端组件 + Flex + inline 主题色，无 H5 专有 CSS）
// 改动说明（短信登录上线）：注册页下线、全面走"验证码登录即注册"，登录改为三屏流程——
// 屏1 手机号 + 获取验证码（主屏，已登录过的设备回填上次手机号）→ 屏2 输码登录；
// 底部分隔线「其他登录方式」图标行平级放四种方式：密码登录（可用）+ 指纹/微信/一键登录（占位）。
import { useEffect, useRef, useState } from 'react'
import { View, Text, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import Icon from '../../components/Icon'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import { useAuthStore } from '../../stores/auth'
import { isChineseMobile } from '../../utils/validate'
import { getItem } from '../../utils/storage'
import './auth.scss'

/** 三屏步骤：手机号输入 / 验证码输入 / 密码输入 */
type Step = 'phone' | 'code' | 'password'

/** 验证码重发倒计时秒数（服务端另有 60 秒频控兜底） */
const RESEND_SECONDS = 60

export default function LoginPage() {
  const t = useTheme()
  const fs = useFs()
  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [agree, setAgree] = useState(false)
  const [msg, setMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [scaffoldMin, setScaffoldMin] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { login, loginSms, sendCode, loading } = useAuthStore()

  // 进入页面：回填上次登录手机号（登录过的设备一步直达）+ 计算脚手架高度让图标行钉底
  useEffect(() => {
    getItem('last_login_phone').then((p) => { if (p) setPhone(p) }).catch(() => { /* 无记录 */ })
    // 改动说明：H5 禁用 vh、RN 不支持 vh，统一用数值 minHeight 跨端撑满（同棋盘尺寸做法）
    try {
      const sys = Taro.getSystemInfoSync()
      const navH = (sys.statusBarHeight || 0) + 44
      if (sys.windowHeight && sys.windowHeight > navH) setScaffoldMin(sys.windowHeight - navH)
    } catch { /* 取不到就退回自然流 */ }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

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

  /** 协议门槛：未勾选拦截一切登录/发码动作 */
  const ensureAgree = () => {
    if (agree) return true
    setMsg('请先阅读并同意《用户协议》和《隐私政策》')
    return false
  }

  /** 登录成功统一收口：提示 + 返回上一页 */
  const onLoginSuccess = () => {
    Taro.showToast({ title: '登录成功', icon: 'success' })
    setTimeout(() => Taro.navigateBack(), 600)
  }

  /** 屏1：获取验证码（校验手机号 → 过协议 → 发码 → 进屏2 并起倒计时） */
  const onSendCode = async () => {
    setMsg('')
    if (!isChineseMobile(phone)) { setMsg('请输入正确的手机号'); return }
    if (!ensureAgree()) return
    setSending(true)
    try {
      await sendCode(phone)
      setCode('')
      setStep('code')
      startCountdown()
    } catch (e: any) {
      setMsg(e?.message || '验证码发送失败，请稍后再试')
    } finally {
      setSending(false)
    }
  }

  /** 屏2：验证码登录（登录即注册） */
  const onLoginByCode = async () => {
    setMsg('')
    if (!code || code.length < 4) { setMsg('请输入验证码'); return }
    if (!ensureAgree()) return
    try {
      await loginSms(phone, code)
      onLoginSuccess()
    } catch (e: any) {
      setMsg(e?.message || '验证码错误或已过期，请重试')
    }
  }

  /** 屏3：密码登录（老账号 / 已设置过密码的账号） */
  const onLoginByPassword = async () => {
    setMsg('')
    if (!isChineseMobile(phone)) { setMsg('请输入正确的手机号'); return }
    if (!password) { setMsg('请输入密码'); return }
    if (!ensureAgree()) return
    try {
      await login(phone, password)
      onLoginSuccess()
    } catch (e: any) {
      setMsg(e?.message || '登录失败，请重试')
    }
  }

  /** 底部图标占位（微信 / 一键登录未接入，点击提示） */
  const methodItem = (name: string, label: string, bg: string, onClick: () => void) => (
    <View className='auth-method' onClick={onClick}>
      <View className='auth-method-icon' style={{ backgroundColor: bg }}>
        {/* 改动说明：配合圆形图标 52→44 收小，内嵌图标 22→20 */}
        <Icon name={name} size={20} color='#FFFFFF' />
      </View>
      <Text className='auth-method-label' style={{ ...fs(11), color: t.textTertiary }}>{label}</Text>
    </View>
  )

  /** 底部统一区：分隔线 + 其他登录方式图标行
   * 改动说明：密码登录从常驻小字升级为图标行平级入口（与指纹/微信/一键并列），
   * 分隔线语义「其他登录方式」下四种方式一目了然。
   * 改动说明（图标行状态机修复）：第一枚永远指向"另一种"登录方式——
   * 手机号/验证码屏显示「密码登录」进密码屏；密码屏显示「验证码登录」回手机号屏
   * （原密码屏仍挂「密码登录」指向自己属废入口；原上方 auth-switch 小字与图标行重复，删除）。 */
  const bottomArea = (
    <>
      <View className='auth-divider'>
        <View className='auth-divider-line' style={{ backgroundColor: t.border }} />
        <Text className='auth-divider-text' style={{ ...fs(12), color: t.textTertiary }}>其他登录方式</Text>
        <View className='auth-divider-line' style={{ backgroundColor: t.border }} />
      </View>

      <View className='auth-methods'>
        {/* 改动说明：图标圆底配色由三灰一绿改为多色区分（验证码青/密码蓝/指纹紫/微信品牌绿不动/一键橙），
            两种方式互切的第一枚颜色也不同，白色图标不变，深浅主题均安全，避免整行灰调雷同 */}
        {step === 'password'
          ? methodItem('shield', '验证码登录', '#14B8A6', () => { setMsg(''); setStep('phone') })
          : methodItem('lock', '密码登录', '#3B82F6', () => { setMsg(''); setStep('password') })}
        {methodItem('fingerprint', '指纹登录', '#8B5CF6', () =>
          Taro.showToast({ title: '指纹登录即将上线', icon: 'none' }))}
        {methodItem('message-circle', '微信登录', '#07C160', () =>
          Taro.showToast({ title: '微信登录即将上线', icon: 'none' }))}
        {methodItem('smartphone', '一键登录', '#F59E0B', () =>
          Taro.showToast({ title: '本机号码一键登录即将上线', icon: 'none' }))}
      </View>
    </>
  )

  /** 协议勾选行（三屏共用同一勾选状态） */
  const agreeRow = (
    <View className='auth-agree'>
      <View
        className='auth-checkbox'
        style={{ borderColor: agree ? t.primary : t.border, backgroundColor: agree ? t.primary : 'transparent' }}
        onClick={() => setAgree(!agree)}
      >
        {agree ? <Icon name='check' size={12} color='#FFFFFF' /> : null}
      </View>
      <Text style={{ ...fs(12), color: t.textTertiary }}> 已阅读并同意 </Text>
      <Text className='auth-link' style={{ ...fs(12), color: t.primaryText }} onClick={() => Taro.navigateTo({ url: '/pages/common/doc?type=user-agreement' })}>《用户协议》</Text>
      <Text style={{ ...fs(12), color: t.textTertiary }}> 和 </Text>
      <Text className='auth-link' style={{ ...fs(12), color: t.primaryText }} onClick={() => Taro.navigateTo({ url: '/pages/common/doc?type=privacy-policy' })}>《隐私政策》</Text>
    </View>
  )

  /** 手机号输入框（屏1/屏3 共用） */
  const phoneField = (
    <View className='auth-field' style={{ backgroundColor: t.bgInput, borderColor: t.border }}>
      <Icon name='phone' size={18} color={t.textTertiary} />
      <Input
        className='auth-input'
        style={{ ...fs(15), color: t.textPrimary }}
        type='number'
        maxlength={11}
        placeholder='点击输入手机号'
        placeholderClass='auth-ph'
        value={phone}
        onInput={(e) => setPhone(e.detail.value)}
      />
    </View>
  )

  /** 主按钮文案与动作随步骤切换 */
  const primary = step === 'phone'
    ? { text: sending ? '发送中…' : '获取验证码', busy: sending, act: onSendCode }
    : step === 'code'
      ? { text: loading ? '登录中…' : '登录', busy: loading, act: onLoginByCode }
      : { text: loading ? '登录中…' : '登录', busy: loading, act: onLoginByPassword }

  /** 标题/副标题随步骤切换
   * 改动说明：屏1 副标题由"验证后自动登录"改为直白点明"自动创建账号"，
   * 让登录即注册的告知更透明（协议勾选之外的第二重知情告知），减轻强制感；
   * 屏1 标题由"手机号登录"改为"验证码登录"，与密码屏"密码登录"成对称语义 */
  const heading = step === 'phone'
    ? { title: '验证码登录', sub: '未注册的手机号将自动创建账号并登录' }
    : step === 'code'
      ? { title: '输入验证码', sub: `验证码已发送至 ${phone.slice(0, 3)}****${phone.slice(7)}` }
      : { title: '密码登录', sub: '使用手机号密码登录' }

  /** 顶栏返回：屏2/屏3 先回屏1，屏1 才退出登录页 */
  const onBack = () => {
    setMsg('')
    if (step === 'phone') Taro.navigateBack()
    else setStep('phone')
  }

  return (
    <PageLayout nav={<NavBar title='登录' showBack onBack={onBack} />}>
      <View
        className='auth-scaffold'
        style={{ backgroundColor: t.bgPage, minHeight: scaffoldMin || undefined }}
      >
        <Text className='auth-title' style={{ ...fs(24), color: t.textPrimary }}>{heading.title}</Text>
        <Text className='auth-sub' style={{ ...fs(13), color: t.textSecondary }}>{heading.sub}</Text>

        {step !== 'code' ? phoneField : null}

        {step === 'code' && (
          <View className='auth-field' style={{ backgroundColor: t.bgInput, borderColor: t.border }}>
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
              style={{ ...fs(13), color: countdown > 0 ? t.textTertiary : t.primaryText }}
              onClick={countdown > 0 ? undefined : onSendCode}
            >{countdown > 0 ? `${countdown}s 后重发` : '重新获取'}</Text>
          </View>
        )}

        {step === 'password' && (
          <View className='auth-field' style={{ backgroundColor: t.bgInput, borderColor: t.border }}>
            <Icon name='lock' size={18} color={t.textTertiary} />
            <Input
              className='auth-input'
              style={{ ...fs(15), color: t.textPrimary }}
              password
              placeholder='请输入密码'
              placeholderClass='auth-ph'
              value={password}
              onInput={(e) => setPassword(e.detail.value)}
            />
          </View>
        )}

        {!!msg && <Text className='auth-msg' style={{ ...fs(13), color: t.danger }}>{msg}</Text>}

        <View className='auth-btn' style={{ backgroundColor: t.primary }} onClick={primary.busy ? undefined : primary.act}>
          <Text className='auth-btn-text' style={{ ...fs(16), color: t.textOnPrimary }}>{primary.text}</Text>
        </View>

        {agreeRow}

        {/* 弹性留白：把切换链接与图标行顶到屏幕底部（minHeight 跨端撑满） */}
        <View className='auth-grow' />

        {bottomArea}
      </View>
    </PageLayout>
  )
}
