// 通知设置页（v1.6.0 通知设置）：用户自勾选接收通知的渠道。
// 站内信恒开不可关（消息中心兜底）；短信仅网关就绪时显示；微信/邮件可勾。
// 数据走 BFF /mobile/notifications/preferences（GET 回显渠道开关 + 网关就绪标记 / PUT 保存）。
// RN 约束：仅 flex 布局、Text 包裹、样式数值。
import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import { useDidShow } from '@tarojs/taro'
import Taro from '@tarojs/taro'
import Icon from '../../components/Icon'
import Switch from '../../components/Switch'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import LoginGuide from '../../components/LoginGuide'
import { useAuthStore } from '../../stores/auth'
import { getNotificationPreferences, updateNotificationPreferences, type NotificationPreferences } from '../../services/notification'

// 编译期配置：禁用外层 ScrollView（与设置页一致）
definePageConfig({ disableScroll: true })

/** 可切换的外部通知渠道键 */
type ChannelKey = 'smsNotificationEnabled' | 'weChatNotificationEnabled' | 'emailNotificationEnabled'

/** 通知设置页 */
export default function NotificationSettingsPage() {
  const t = useTheme()
  const fs = useFs()
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null)

  useDidShow(() => {
    if (isLoggedIn) void getNotificationPreferences().then(setPrefs)
  })

  /** 切换某渠道开关（乐观更新 + 失败回滚提示） */
  const onToggle = async (key: ChannelKey, value: boolean) => {
    if (!prefs) return
    const prev = prefs
    setPrefs({ ...prefs, [key]: value })
    try {
      const patch: Partial<NotificationPreferences> = {}
      patch[key] = value
      await updateNotificationPreferences(patch)
    } catch {
      setPrefs(prev)
      Taro.showToast({ title: '保存失败，请稍后重试', icon: 'none' })
    }
  }

  /** 单行（图标 + 标题说明 + 开关） */
  const row = (icon: string, label: string, desc: string, checked: boolean, disabled: boolean, onChange?: (v: boolean) => void) => (
    <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', paddingLeft: 14, paddingRight: 14, paddingTop: 12, paddingBottom: 12, borderStyle: 'solid', borderWidth: 0, borderBottomWidth: 1, borderBottomColor: t.border }}>
      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: t.primaryLight, alignItems: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <Icon name={icon} size={18} color={t.primary} />
      </View>
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={{ ...fs(15), color: t.textPrimary }}>{label}</Text>
        <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 2 }}>{desc}</Text>
      </View>
      <Switch checked={checked} disabled={disabled} onChange={(v) => onChange && onChange(v)} />
    </View>
  )

  return (
    <PageLayout nav={<NavBar title="通知设置" showBack />}>
      <View style={{ padding: 12 }}>
        {!isLoggedIn ? (
          <View style={{ paddingTop: 40 }}>
            <LoginGuide icon='bell' text='登录后可设置通知方式' />
          </View>
        ) : (
          <View style={{ backgroundColor: t.bgCard, borderRadius: 12, overflow: 'hidden' }}>
            {row('bell', '站内信', '消息中心接收，作为兜底通道不可关闭', true, true)}
            {/* 短信通道未接网关时不显示，避免"勾了收不到" */}
            {prefs?.smsGatewayReady
              ? row('message-square', '短信', '匹配寻货等重要提醒以短信发送到手机号', prefs.smsNotificationEnabled, false, (v) => void onToggle('smsNotificationEnabled', v))
              : null}
            {row('message-circle', '微信通知', '通过微信服务通知接收提醒', prefs?.weChatNotificationEnabled ?? true, false, (v) => void onToggle('weChatNotificationEnabled', v))}
            {row('mail', '邮件通知', '通过邮箱接收提醒', prefs?.emailNotificationEnabled ?? true, false, (v) => void onToggle('emailNotificationEnabled', v))}
          </View>
        )}
        <Text style={{ ...fs(11), color: t.textTertiary, marginTop: 12, marginLeft: 4, marginRight: 4 }}>
          站内信始终开启；短信/微信/邮件为补充通道，接入网关后生效。
        </Text>
      </View>
    </PageLayout>
  )
}