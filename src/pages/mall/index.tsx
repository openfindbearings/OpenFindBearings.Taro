// 积分商城页（v1.7.5 占位）：规划承载会员积分兑换（已赚积分单向兑换自营小礼品）。
// 改动说明：本轮仅占位导航与空态。合规设计已确认三条纪律——积分只能赚不能充值
//   （避开单用途预付卡备案）、不可提现/转让（避开支付业务许可）、兑换品为合格自营商品；
//   实现待商户入驻主线跑通后另起一期。
// RN 约束：仅 flex 布局、无 fixed/vh、Text 包裹、lineHeight 数值。
import { View, Text } from '@tarojs/components'
import Icon from '../../components/Icon'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import CustomTabBar from '../../components/CustomTabBar'

/** 积分商城页：会员积分兑换（建设中占位） */
export default function MallPage() {
  const t = useTheme()
  const fs = useFs()

  return (
    <PageLayout nav={<NavBar title='积分商城' />} tabbar={<CustomTabBar />}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingLeft: 32, paddingRight: 32 }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: t.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name='gift' size={34} color={t.primary} />
        </View>
        <Text style={{ ...fs(17), color: t.textPrimary, marginTop: 16, fontWeight: '600' }}>积分商城</Text>
        <Text style={{ ...fs(13), color: t.textTertiary, marginTop: 8, textAlign: 'center' }}>
          活跃赚积分，积分可兑换精选小礼品。积分不可充值、不可提现、不可转让。
        </Text>
        <View style={{ borderRadius: 14, paddingLeft: 12, paddingRight: 12, paddingTop: 4, paddingBottom: 4, marginTop: 14, backgroundColor: t.bgInput }}>
          <Text style={{ ...fs(12), color: t.textSecondary }}>功能建设中，敬请期待</Text>
        </View>
      </View>
    </PageLayout>
  )
}
