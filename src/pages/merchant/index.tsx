// 入驻/商家页（Tab 根页）
// v1.7.0 度量重构：接入 PageLayout（删 rnHeight/自管 ScrollView hack）
// 改动说明：入驻状态真实化——由本地 storage merchant_approved 假 key 改为从
// BFF /mobile/merchants/application 拉取（一人多商户，有 Active 商户即视为已入驻）
import Icon from '../../components/Icon'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { IS_H5 } from '../../utils/platform'
import { useTheme } from '../../hooks/useTheme'
import { useFs } from '../../hooks/useFontScale'
import { useAuthStore } from '../../stores/auth'
import { useMerchantStore } from '../../stores/merchant'
import PageLayout from '../../platforms/PageLayout'
import NavBar from '../../components/NavBar'
import CustomTabBar from '../../components/CustomTabBar'
import { uploadLicense } from '../../services/merchant'
import './index.scss'

// 编译期配置：禁用外层 ScrollView，滚动由 PageLayout 内部统一提供
definePageConfig({ disableScroll: true })

export default function MerchantPage() {
  // 主题色板（占位图标底/图标/文字随模式）+ 全局字号
  const t = useTheme()
  const fs = useFs()
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn)
  const merchants = useMerchantStore((s) => s.merchants)
  const fetchApplications = useMerchantStore((s) => s.fetchApplications)
  const switchMerchant = useMerchantStore((s) => s.switchMerchant)
  const currentMerchantId = useMerchantStore((s) => s.currentMerchantId)
  // 修复 B2：approved 直接派生自 store（原 useState + 渲染闭包读取旧值，
  // 提交申请返回后状态不更新；派生写法随 store 更新自动重渲染，根除闭包问题）
  const approved = isLoggedIn && merchants.length > 0
  // 改动说明 B5：多商户切换器——当前商户名 + 切换入口（仅多商户时显示）
  const current = merchants.find((m) => m.merchantId === currentMerchantId) ?? merchants[0]

  const onSwitchMerchant = () => {
    Taro.showActionSheet({ itemList: merchants.map((m) => m.merchantName) })
      .then((res) => {
        const target = merchants[res.tapIndex]
        if (target) void switchMerchant(target.merchantId)
      })
      .catch(() => { /* 取消 */ })
  }

  useDidShow(() => {
    // 登录态由 auth store 保证；拉取真实入驻状态（失败保留 store 现值）
    if (isLoggedIn) {
      fetchApplications().catch(() => { /* 拉取失败保持当前状态 */ })
    }
  })

  return (
    <PageLayout nav={<NavBar title={approved ? '商家' : '入驻'} />} tabbar={<CustomTabBar />}>
      {/* H5 下 PageLayout body 是块级、无固定高，placeholder 的 flex:1 撑不满导致不居中；
          给一个可视高(视口 - 顶栏44 - 底栏56)让其 flex column 垂直居中。RN 靠 flex:1 已居中，不加。 */}
      <View className='placeholder' style={IS_H5 ? { minHeight: 'calc(100vh - 100px)' } : undefined}>
        {/* 改动说明 B5：多商户当前上下文条（点击切换） */}
        {approved && merchants.length > 1 && (
          <View
            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.bgCard, borderRadius: 20, paddingLeft: 14, paddingRight: 14, paddingTop: 8, paddingBottom: 8, marginBottom: 16, alignSelf: 'center' }}
            onClick={onSwitchMerchant}
          >
            <Text style={{ ...fs(13), color: t.textPrimary }}>{current?.merchantName}</Text>
            <Icon name="chevron-down" size={14} color={t.textSecondary} />
          </View>
        )}
        <View className='placeholder-icon' style={{ backgroundColor: t.primaryLight }}>
          <Icon name="store" size={48} color={t.primary} />
        </View>
        <Text className='placeholder-title' style={{ ...fs(17), color: t.textPrimary }}>
          {approved ? '商家管理' : '商家入驻'}
        </Text>
        <Text className='placeholder-desc' style={{ ...fs(14), color: t.textTertiary }}>
          {approved ? '商家信息维护与商品管理' : '商家入驻申请与店铺管理'}
        </Text>
        {!approved && (
          <View style={{ alignItems: 'center' }}>
            <View
              className='placeholder-btn'
              style={{ backgroundColor: t.primary, borderRadius: 24, paddingTop: 12, paddingBottom: 12, paddingLeft: 40, paddingRight: 40, marginTop: 20 }}
              onClick={() => {
                if (!isLoggedIn) {
                  Taro.showToast({ title: '请先登录', icon: 'none' })
                  return
                }
                Taro.navigateTo({ url: '/pages/merchant/apply' })
              }}
            >
              <Text style={{ ...fs(16), color: t.textOnPrimary }}>申请入驻</Text>
            </View>
            {/* 改动说明 G2：入驻模式 B 入口——员工发起提名管理员 / 查看发给自己的提名 */}
            {isLoggedIn && (
              <View style={{ flexDirection: 'row', marginTop: 14 }}>
                <Text
                  style={{ ...fs(14), color: t.primary, marginRight: 18 }}
                  onClick={() => Taro.navigateTo({ url: '/pages/merchant/nominate' })}
                >
                  提名他人任管理员
                </Text>
                <Text
                  style={{ ...fs(14), color: t.primary }}
                  onClick={() => Taro.navigateTo({ url: '/pages/merchant/nominations' })}
                >
                  待我接受的提名
                </Text>
              </View>
            )}
          </View>
        )}
        {approved && (
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
            <View
              className='placeholder-btn'
              style={{ backgroundColor: t.primary, borderRadius: 24, paddingTop: 12, paddingBottom: 12, paddingLeft: 30, paddingRight: 30 }}
              onClick={() => Taro.navigateTo({ url: '/pages/merchant/manage' })}
            >
              <Text style={{ ...fs(16), color: t.textOnPrimary }}>商品管理</Text>
            </View>
            <View
              className='placeholder-btn'
              style={{ backgroundColor: t.bgCard, borderRadius: 24, paddingTop: 12, paddingBottom: 12, paddingLeft: 30, paddingRight: 30, borderWidth: 1, borderColor: t.primary }}
              onClick={() => Taro.navigateTo({ url: '/pages/merchant/members' })}
            >
              <Text style={{ ...fs(16), color: t.primary }}>成员管理</Text>
            </View>
          </View>
        )}
        {/* 改动说明 G3：店铺认证——已入驻未认证时上传营业执照（Admin 审核后获得认证） */}
        {approved && current && !current.isVerified && (
          <View
            style={{ marginTop: 14, backgroundColor: t.bgCard, borderRadius: 10, borderWidth: 1, borderColor: t.border, paddingTop: 10, paddingBottom: 10, paddingLeft: 16, paddingRight: 16 }}
            onClick={async () => {
              try {
                const r = await uploadLicense()
                Taro.showToast({ title: r?.message || '已提交', icon: 'none' })
                void fetchApplications()
              } catch {
                Taro.showToast({ title: '上传失败', icon: 'none' })
              }
            }}
          >
            <Text style={{ ...fs(14), color: t.primary }}>上传营业执照，申请商家认证</Text>
          </View>
        )}
        {approved && current?.isVerified && (
          <Text style={{ ...fs(13), color: t.textTertiary, marginTop: 10 }}>商家已认证</Text>
        )}
      </View>
    </PageLayout>
  )
}
