// 登录引导空态（v1.7.21）：需登录页面未登录时的统一样式——图标 + 引导文案 + 去登录按钮。
// 改动说明：收藏/关注页首创的引导空态抽为组件，纠错/我的寻货/任务中心/通知等页复用，
// 全站"未登录可见性"风格统一（RN 约束：纯 flex + 数值样式）
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import Icon from '../Icon'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'

/** 登录引导空态参数 */
export interface LoginGuideProps {
  /** 图标名（lucide 名，如 heart/file_text/compass/gift/bell） */
  icon: string
  /** 引导文案，如"登录后可查看我的纠错" */
  text: string
}

/** 需登录页面的未登录引导空态 */
export default function LoginGuide({ icon, text }: LoginGuideProps) {
  const t = useTheme()
  const fs = useFs()
  return (
    <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 80 }}>
      <Icon name={icon} size={48} color={t.textTertiary} />
      <Text style={{ ...fs(15), color: t.textSecondary, marginTop: 12 }}>{text}</Text>
      <View
        style={{ backgroundColor: t.primary, borderRadius: 20, paddingLeft: 24, paddingRight: 24, paddingTop: 9, paddingBottom: 9, marginTop: 16 }}
        onClick={() => Taro.navigateTo({ url: '/pages/auth/login' })}
      >
        <Text style={{ ...fs(15), color: t.textOnPrimary }}>去登录</Text>
      </View>
    </View>
  )
}
