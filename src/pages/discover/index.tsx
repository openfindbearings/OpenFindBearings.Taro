// 发现页（v1.7.5 占位）：规划承载商户求货需求板（B2B 求购信息发布与浏览）。
// 改动说明：本轮仅占位导航与空态，功能实现待商户入驻主线跑通后另起一期；
//   合规前提已在设计阶段确认——信息发布类需内容审核机制（复用 Admin 审核体系）后再放开 UGC。
// RN 约束：仅 flex 布局、无 fixed/vh、Text 包裹、lineHeight 数值。
import { View, Text } from '@tarojs/components'
import Icon from '../../components/Icon'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import CustomTabBar from '../../components/CustomTabBar'

/** 发现页：求货需求板（建设中占位） */
export default function DiscoverPage() {
  const t = useTheme()
  const fs = useFs()

  return (
    <PageLayout nav={<NavBar title='发现' />} tabbar={<CustomTabBar />}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingLeft: 32, paddingRight: 32 }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: t.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name='compass' size={34} color={t.primary} />
        </View>
        <Text style={{ ...fs(17), color: t.textPrimary, marginTop: 16, fontWeight: '600' }}>发现 · 求货需求</Text>
        <Text style={{ ...fs(13), color: t.textTertiary, marginTop: 8, textAlign: 'center' }}>
          商家发布的求购/供应信息将在这里展示，点对点找货更直接。
        </Text>
        <View style={{ borderRadius: 14, paddingLeft: 12, paddingRight: 12, paddingTop: 4, paddingBottom: 4, marginTop: 14, backgroundColor: t.bgInput }}>
          <Text style={{ ...fs(12), color: t.textSecondary }}>功能建设中，敬请期待</Text>
        </View>
      </View>
    </PageLayout>
  )
}
