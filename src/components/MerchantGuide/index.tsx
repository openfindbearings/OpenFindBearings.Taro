// 商户身份引导空态（v1.4.16）：已登录但尚未入驻时的统一空态，避免商户类页面显示成"暂无数据"假空态。
// 与 LoginGuide 成对使用：未登录 -> LoginGuide；已登录未入驻 -> 本组件（按钮去申请入驻）。
// RN 约束：纯 flex + 数值样式，Text 包裹文字。
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import Icon from '../Icon'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'

/** 商户身份引导空态参数 */
export interface MerchantGuideProps {
  /** 图标名（lucide 名，如 store/package） */
  icon?: string
  /** 引导文案，如"你还没有入驻商家，入驻通过后可管理商品" */
  text: string
}

/** 已登录未入驻时的引导空态：提示申请入驻，点击进入驻申请页 */
export default function MerchantGuide({ icon = 'store', text }: MerchantGuideProps) {
  const t = useTheme()
  const fs = useFs()
  return (
    <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 80 }}>
      <Icon name={icon} size={48} color={t.textTertiary} />
      <Text style={{ ...fs(15), color: t.textSecondary, marginTop: 12, paddingLeft: 32, paddingRight: 32, textAlign: 'center' }}>{text}</Text>
      <View
        style={{ backgroundColor: t.primary, borderRadius: 20, paddingLeft: 24, paddingRight: 24, paddingTop: 9, paddingBottom: 9, marginTop: 16 }}
        onClick={() => Taro.navigateTo({ url: '/pages/merchant/apply' })}
      >
        <Text style={{ ...fs(15), color: t.textOnPrimary }}>去申请入驻</Text>
      </View>
    </View>
  )
}
